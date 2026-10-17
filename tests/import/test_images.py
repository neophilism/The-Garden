import hashlib
import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from image_fixture import make, drawing, xml, rels, IMAGE_REL

spec = importlib.util.spec_from_file_location('garden_images', Path(__file__).resolve().parents[2] / 'services/workers/import/images.py')
images = importlib.util.module_from_spec(spec)
spec.loader.exec_module(images)


class ImageInventoryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='garden-image-test-')
        self.addCleanup(self.directory.cleanup)
        self.path = os.path.join(self.directory.name, 'source.docx')

    def scan(self, config=None, **options):
        config = config or make(self.path, **options)
        return images.scan_docx(config['sourcePath'], config['document'])

    def codes(self, report):
        return {item['code'] for item in report['findings']}

    def test_exact_bytes_all_document_parts_and_preserved_metadata(self):
        config = make(self.path, body=drawing(alt='  Exact e\u0301 <catalog text>  ', title=''), extra={
            'word/header1.xml': xml(drawing()), 'word/_rels/header1.xml.rels': rels(),
            'word/footnotes.xml': xml(drawing()), 'word/_rels/footnotes.xml.rels': rels(),
            'word/endnotes.xml': xml(drawing()), 'word/_rels/endnotes.xml.rels': rels()})
        before = Path(self.path).read_bytes()
        report = self.scan(config)
        self.assertEqual(Path(self.path).read_bytes(), before)
        self.assertEqual(report['media'][0]['sha256'], hashlib.sha256(b'synthetic exact image bytes').hexdigest())
        self.assertEqual(report['counts'], {'mediaMembers': 1, 'distinctByteAssets': 1, 'storedPlacements': 4, 'resolvedPlacements': 4, 'renderedPlacements': None})
        p = next(p for p in report['placements'] if p['part'] == 'word/document.xml')
        self.assertEqual(p['metadata'][0]['altText'], '  Exact e\u0301 <catalog text>  ')
        self.assertEqual(p['metadata'][0]['title'], '')
        self.assertEqual(p['crops'][0]['attributes']['l'], '1000')
        self.assertEqual(p['extents'][0]['attributes']['cx'], '914400')

    def test_duplicate_bytes_members_and_placements_are_distinct(self):
        report = self.scan(body=drawing() + drawing('r2') + drawing(), relationships=[('r1', 'media/a.png', 'Internal', IMAGE_REL), ('r2', 'media/b.png', 'Internal', IMAGE_REL)], media={'word/media/a.png': b'same bytes', 'word/media/b.png': b'same bytes'})
        self.assertEqual(report['counts']['mediaMembers'], 2)
        self.assertEqual(report['counts']['distinctByteAssets'], 1)
        self.assertEqual(report['counts']['storedPlacements'], 3)
        self.assertEqual(len({p['placementId'] for p in report['placements']}), 3)

    def test_changed_bytes_change_identity_even_with_same_filename(self):
        before = self.scan()
        after = self.scan(media={'word/media/a.png': b'different bytes'})
        self.assertNotEqual(before['media'][0]['sha256'], after['media'][0]['sha256'])
        self.assertNotEqual(before['placements'][0]['placementId'], after['placements'][0]['placementId'])

    def test_missing_media_relationship_and_external_target_are_explicit(self):
        report = self.scan(body=drawing() + drawing('missing') + drawing('remote'), relationships=[('r1', 'media/absent.png', 'Internal', IMAGE_REL), ('remote', 'https://example.invalid/private?token=preserved-only', 'External', IMAGE_REL)])
        self.assertTrue({'missing-media-member', 'unresolved-relationship', 'external-not-fetched', 'external-image-not-fetched'} <= self.codes(report))
        self.assertEqual(report['counts']['resolvedPlacements'], 0)
        self.assertTrue(all(p['sha256'] is None for p in report['placements']))

    def test_wrong_type_and_unsafe_target_never_resolve(self):
        for target, kind, code in [('media/a.png', IMAGE_REL + '-wrong', 'wrong-relationship-type'), ('../../../private.png', IMAGE_REL, 'unsafe-internal-target'), ('media/a.png?secret=1', IMAGE_REL, 'unsafe-internal-target')]:
            with self.subTest(target=target):
                report = self.scan(relationships=[('r1', target, 'Internal', kind)])
                self.assertIn(code, self.codes(report))
                self.assertIsNone(report['placements'][0]['sha256'])

    def test_duplicate_relationship_id_is_ambiguous(self):
        report = self.scan(relationships=[('r1', 'media/a.png', 'Internal', IMAGE_REL)] * 3)
        self.assertIn('duplicate-relationship-id', self.codes(report))
        self.assertEqual(report['placements'][0]['status'], 'unresolved-relationship')

    def test_unused_media_has_a_disposition(self):
        report = self.scan(media={'word/media/a.png': b'used', 'word/media/unused.png': b'unused'})
        self.assertIn('media-member-without-resolved-placement', self.codes(report))
        self.assertEqual(report['counts']['mediaMembers'], 2)

    def test_alternative_markup_counts_references_without_claiming_rendered_count(self):
        report = self.scan(body='<mc:AlternateContent><mc:Choice Requires="w">' + drawing() + '</mc:Choice><mc:Fallback>' + drawing() + '</mc:Fallback></mc:AlternateContent>')
        self.assertEqual(report['counts']['storedPlacements'], 2)
        self.assertIsNone(report['counts']['renderedPlacements'])
        self.assertEqual([p['alternative'] for p in report['placements']], ['Choice', 'Fallback'])
        self.assertIn('alternative-representation-not-rendered', self.codes(report))

    def test_vml_metadata_and_svg_alternative_are_not_lost(self):
        report = self.scan(body='<w:p><w:r><w:pict><v:shape alt="VML alt"><v:imagedata r:id="r1" cropleft=".1"/></v:shape></w:pict><a:blip r:embed="r1"><a:extLst><svg:svgBlip r:embed="r1"/></a:extLst></a:blip></w:r></w:p>')
        self.assertEqual({p['kind'] for p in report['placements']}, {'vml', 'drawingml', 'svg-alternative'})
        self.assertEqual(report['placements'][0]['metadata'][0]['altText'], 'VML alt')

    def test_strict_ooxml_unsupported_scope_is_explicit(self):
        report = self.scan(extra={'word/document.xml': b'<w:document xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main"/>'})
        self.assertIn('strict-ooxml-markup-not-supported', self.codes(report))
        self.assertIn('image-relationships-without-supported-placement', self.codes(report))

    def test_dtd_and_utf16_entity_declarations_rejected(self):
        for data in ['<!DOCTYPE x [<!ENTITY e "expanded">]><x>&e;</x>'.encode(), '<!DOCTYPE x [<!ENTITY e "expanded">]><x>&e;</x>'.encode('utf-16')]:
            config = make(self.path, extra={'word/document.xml': data})
            with self.assertRaises(images.Rejected):
                self.scan(config)

    def test_unsafe_and_colliding_archive_names_rejected(self):
        for name in ['../outside.png', '/absolute.png', 'word\\media\\a.png', 'word/media/A.PNG', 'word/media/a%2Epng']:
            with self.subTest(name=name):
                config = make(self.path, extra={name: b'unsafe'})
                with self.assertRaises(images.Rejected):
                    self.scan(config)

    def test_symlink_archive_member_rejected(self):
        make(self.path)
        with zipfile.ZipFile(self.path, 'a') as archive:
            info = zipfile.ZipInfo('word/media/link.png')
            info.create_system = 3
            info.external_attr = 0o120777 << 16
            archive.writestr(info, b'/etc/secret')
        data = Path(self.path).read_bytes()
        with self.assertRaises(images.Rejected):
            self.scan({'sourcePath': self.path, 'document': {'editionId': 'test', 'documentId': 'test', 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}})

    def test_hash_size_and_path_mismatches_rejected(self):
        config = make(self.path)
        for key, value in [('sha256', '0' * 64), ('size', config['document']['size'] + 1)]:
            changed = {**config, 'document': {**config['document'], key: value}}
            with self.assertRaises(images.Rejected):
                self.scan(changed)
        for path in ['relative.docx', os.path.join(self.directory.name, 'link.docx')]:
            if path.endswith('link.docx'):
                os.symlink(self.path, path)
            with self.assertRaises(images.Rejected):
                self.scan({**config, 'sourcePath': path})

    def test_hard_link_source_rejected(self):
        config = make(self.path)
        os.link(self.path, self.path + '-link')
        with self.assertRaises(images.Rejected):
            self.scan(config)

    def test_source_mutation_and_revocation_cannot_complete(self):
        config = make(self.path)
        def mutate(phase):
            if phase == 'verify-source':
                with open(self.path, 'ab') as source:
                    source.write(b'changed')
        with self.assertRaises(images.Rejected):
            images.scan_docx(self.path, config['document'], mutate)
        config = make(self.path)
        def deny(phase):
            if phase == 'scan-media':
                raise PermissionError()
        with self.assertRaises(PermissionError):
            images.scan_docx(self.path, config['document'], deny)

    def test_resource_bounds_fail_without_truncation(self):
        config = make(self.path)
        for key, value in [('MAX_ENTRIES', 1), ('MAX_XML', 1), ('MAX_EXPANDED', 1), ('MAX_PLACEMENTS', 0), ('MAX_REPORT', 1)]:
            with self.subTest(key=key), patch.object(images, key, value), self.assertRaises(images.Rejected):
                self.scan(config)

    def test_duplicate_physical_member_rejected(self):
        make(self.path)
        with zipfile.ZipFile(self.path, 'a') as archive:
            archive.writestr('word/media/a.png', b'other')
        data = Path(self.path).read_bytes()
        with self.assertRaises(images.Rejected):
            self.scan({'sourcePath': self.path, 'document': {'editionId': 'test', 'documentId': 'test', 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}})


if __name__ == '__main__':
    unittest.main()
