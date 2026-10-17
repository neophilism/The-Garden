"""GDN-047: read-only DOCX media/placement inventory, never an image renderer.

The parent supplies an authorized immutable file, exact byte binding and gates.
No archive member is extracted to disk, no URL is fetched, and no caption,
identity, archival status or reproduction right is inferred from appearance.
"""
import hashlib
import json
import os
import posixpath
import re
import resource
import stat
import sys
import unicodedata
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET

PROFILE = 'garden-docx-media-v1'
MAX_SOURCE = 1024 ** 3
MAX_EXPANDED = 2 * 1024 ** 3
MAX_MEMBER = 128 * 1024 ** 2
MAX_XML = 32 * 1024 ** 2
MAX_ENTRIES = 20000
MAX_NODES = 350000
MAX_PLACEMENTS = 20000
MAX_REPORT = 48 * 1024 ** 2
NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'v': 'urn:schemas-microsoft-com:vml',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'svg': 'http://schemas.microsoft.com/office/drawing/2016/SVG/main',
}
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
CONTENT = 'http://schemas.openxmlformats.org/package/2006/content-types'
IMAGE_REL = NS['r'] + '/image'
STRICT_IMAGE_REL = 'http://purl.oclc.org/ooxml/officeDocument/relationships/image'


class Rejected(Exception):
    pass


def require(value):
    if not value:
        raise Rejected()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def safe_name(name):
    return (isinstance(name, str) and 0 < len(name) <= 600 and
            not any(ord(c) < 32 or ord(c) == 127 for c in name) and
            not any(c in name for c in ('\\', ':', '?', '#', '%')) and
            not name.startswith('/') and
            all(p not in ('', '.', '..') for p in name.rstrip('/').split('/')) and
            posixpath.normpath(name.rstrip('/')) == name.rstrip('/'))


def same_stat(a, b):
    return (a.st_dev, a.st_ino, a.st_size, a.st_mtime_ns, a.st_ctime_ns) == (
        b.st_dev, b.st_ino, b.st_size, b.st_mtime_ns, b.st_ctime_ns)


def file_hash(handle, gate):
    handle.seek(0)
    digest = hashlib.sha256()
    total = 0
    while True:
        data = handle.read(1024 * 1024)
        if not data:
            break
        digest.update(data)
        total += len(data)
        if total % (32 * 1024 * 1024) == 0:
            gate('source-hash')
    return digest.hexdigest()


def xml(data):
    # XML entities and DTDs are never required for OOXML. Reject before parsing,
    # including UTF-16 markup; never resolve external XML resources.
    require(len(data) <= MAX_XML)
    sample = data.replace(b'\x00', b'').upper()
    require(b'<!DOCTYPE' not in sample and b'<!ENTITY' not in sample)
    root = ET.fromstring(data)
    paths, parents = {}, {}
    stack = [(root, '/' + root.tag + '[1]', None, 0)]
    while stack:
        node, path, parent, depth = stack.pop()
        require(depth <= 100 and len(paths) < MAX_NODES and len(path) <= 12000)
        paths[node] = path
        parents[node] = parent
        counts = {}
        children = []
        for child in node:
            counts[child.tag] = counts.get(child.tag, 0) + 1
            children.append((child, path + '/' + child.tag + '[' + str(counts[child.tag]) + ']', node, depth + 1))
        stack.extend(reversed(children))
    return root, paths, parents


def internal_target(part, raw):
    if not isinstance(raw, str) or not raw or len(raw) > 1200 or '\\' in raw:
        return None
    try:
        parsed = urllib.parse.urlsplit(raw)
        if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
            return None
        decoded = urllib.parse.unquote(parsed.path, errors='strict')
        if '%' in decoded:
            return None
        # Absolute OPC names are archive-root relative, not filesystem paths.
        target = posixpath.normpath(decoded.lstrip('/') if decoded.startswith('/') else posixpath.join(posixpath.dirname(part), decoded))
        return target if safe_name(target) else None
    except (ValueError, UnicodeError):
        return None


def scan_docx(path, document, gate=lambda phase: None):
    require(isinstance(path, str) and os.path.isabs(path) and os.path.realpath(path) == path)
    require(set(document) == {'editionId', 'documentId', 'sha256', 'size'})
    require(isinstance(document['size'], int) and 0 < document['size'] <= MAX_SOURCE)
    require(isinstance(document['sha256'], str) and re.fullmatch('[a-f0-9]{64}', document['sha256']))
    for key in ('editionId', 'documentId'):
        require(isinstance(document[key], str) and 0 < len(document[key]) <= 200)
    gate('open-source')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as handle:
        original = os.fstat(handle.fileno())
        require(stat.S_ISREG(original.st_mode) and original.st_nlink == 1 and original.st_size == document['size'])
        require(file_hash(handle, gate) == document['sha256'])
        report = {'profile': PROFILE, 'document': dict(document), 'media': [], 'placements': [], 'findings': []}
        issues = report['findings']

        def issue(code, part=None, locator=None, target=None):
            require(len(issues) < 60000)
            issues.append({'code': code, 'part': part, 'locator': locator, 'target': target})

        with zipfile.ZipFile(handle) as archive:
            entries = archive.infolist()
            require(len(entries) <= MAX_ENTRIES)
            members, seen, expanded = {}, set(), 0
            for item in entries:
                name = item.orig_filename
                normalized = unicodedata.normalize('NFC', name).casefold().rstrip('/')
                mode = item.external_attr >> 16
                require(safe_name(name) and normalized not in seen and not stat.S_ISLNK(mode))
                require(stat.S_IFMT(mode) in (0, stat.S_IFREG, stat.S_IFDIR))
                require(not item.flag_bits & 1 and item.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED))
                require(0 <= item.file_size <= MAX_MEMBER and item.file_size <= max(1, item.compress_size) * 1000)
                seen.add(normalized)
                expanded += item.file_size
                require(expanded <= MAX_EXPANDED)
                if not item.is_dir():
                    members[name] = item
                else:
                    require(item.file_size == 0)
            require('[Content_Types].xml' in members and 'word/document.xml' in members)

            def read_member(name, limit=MAX_XML):
                require(members[name].file_size <= limit)
                with archive.open(members[name]) as source:
                    data = source.read(limit + 1)
                require(len(data) <= limit and len(data) == members[name].file_size)
                return data

            types_root, _, _ = xml(read_member('[Content_Types].xml'))
            require(types_root.tag == '{' + CONTENT + '}Types')
            defaults, overrides = {}, {}
            for child in types_root:
                if child.tag == '{' + CONTENT + '}Default':
                    ext, content_type = child.get('Extension'), child.get('ContentType')
                    require(ext and ext not in defaults and isinstance(content_type, str))
                    defaults[ext.lower()] = content_type
                elif child.tag == '{' + CONTENT + '}Override':
                    name, content_type = child.get('PartName'), child.get('ContentType')
                    require(isinstance(name, str) and name.startswith('/') and name[1:] not in overrides and isinstance(content_type, str))
                    overrides[name[1:]] = content_type
                else:
                    raise Rejected()
            content_type = lambda name: overrides.get(name, defaults.get(name.rsplit('.', 1)[-1].lower(), None))
            relations, image_targets = {}, set()
            for name in sorted(members):
                if name.endswith('.rels'):
                    gate('scan-part')
                    root, paths, _ = xml(read_member(name))
                    require(root.tag == '{' + REL + '}Relationships')
                    part = '' if name == '_rels/.rels' else posixpath.join(posixpath.dirname(posixpath.dirname(name)), posixpath.basename(name)[:-5])
                    rels = {}
                    for rel in root:
                        require(rel.tag == '{' + REL + '}Relationship')
                        rid, target, kind, mode = rel.get('Id'), rel.get('Target'), rel.get('Type'), rel.get('TargetMode', 'Internal')
                        require(rid and isinstance(target, str) and isinstance(kind, str) and mode in ('Internal', 'External'))
                        if rid in rels:
                            issue('duplicate-relationship-id', part, paths[rel], rid)
                            rels[rid] = None
                            continue
                        resolved = internal_target(part, target) if mode == 'Internal' else None
                        rels[rid] = {'target': target, 'memberPath': resolved, 'mode': mode, 'type': kind}
                        if kind in (IMAGE_REL, STRICT_IMAGE_REL) and resolved:
                            image_targets.add(resolved)
                        if mode == 'External' and kind in (IMAGE_REL, STRICT_IMAGE_REL):
                            issue('external-image-not-fetched', part, paths[rel], target)
                    relations[part] = rels

            media_names = {name for name in members if name.startswith('word/media/') or (content_type(name) or '').startswith('image/') or name in image_targets}
            media_by_name = {}
            for name in sorted(media_names):
                gate('scan-media')
                digest, size = hashlib.sha256(), 0
                with archive.open(members[name]) as source:
                    while True:
                        block = source.read(1024 * 1024)
                        if not block:
                            break
                        digest.update(block)
                        size += len(block)
                        require(size <= MAX_MEMBER and size <= members[name].file_size)
                        if size % (16 * 1024 * 1024) == 0:
                            gate('scan-media')
                require(size == members[name].file_size)
                item = {'memberPath': name, 'sha256': digest.hexdigest(), 'size': size, 'contentType': content_type(name)}
                media_by_name[name] = item
                report['media'].append(item)
                if not (content_type(name) or '').startswith('image/'):
                    issue('media-content-type-unresolved', name)

            referenced = set()
            for name in sorted(members):
                if not name.startswith('word/') or not name.endswith('.xml'):
                    continue
                gate('scan-part')
                root, paths, parents = xml(read_member(name))
                if root.tag.startswith('{http://purl.oclc.org/ooxml/'):
                    issue('strict-ooxml-markup-not-supported', name)
                for node in root.iter():
                    if node.tag not in ('{' + NS['a'] + '}blip', '{' + NS['v'] + '}imagedata', '{' + NS['svg'] + '}svgBlip'):
                        continue
                    require(len(report['placements']) < MAX_PLACEMENTS)
                    locator = paths[node]
                    kind = 'vml' if node.tag == '{' + NS['v'] + '}imagedata' else ('svg-alternative' if node.tag == '{' + NS['svg'] + '}svgBlip' else 'drawingml')
                    identifiers = [node.get('{' + NS['r'] + '}' + attr) for attr in ('embed', 'link', 'id')]
                    identifiers = [rid for rid in identifiers if rid]
                    rid = identifiers[0] if len(identifiers) == 1 else None
                    relation = relations.get(name, {}).get(rid)
                    target = relation['memberPath'] if relation else None
                    item = media_by_name.get(target)
                    status = 'resolved'
                    if not relation:
                        status = 'unresolved-relationship'
                    elif relation['mode'] == 'External':
                        status = 'external-not-fetched'
                    elif relation['type'] not in (IMAGE_REL, STRICT_IMAGE_REL):
                        status = 'wrong-relationship-type'
                    elif target is None:
                        status = 'unsafe-internal-target'
                    elif item is None:
                        status = 'missing-media-member'
                    if status != 'resolved':
                        issue(status, name, locator, relation['target'] if relation else rid)
                    else:
                        referenced.add(target)
                    ancestors, ancestor = [], node
                    while ancestor is not None:
                        ancestors.append(ancestor)
                        ancestor = parents[ancestor]
                    container = next((a for a in ancestors if a.tag in ('{' + NS['wp'] + '}inline', '{' + NS['wp'] + '}anchor', '{' + NS['v'] + '}shape')), None)
                    metadata, crops, extents = [], [], []
                    if container is not None:
                        for child in container.iter():
                            if child.tag in ('{' + NS['wp'] + '}docPr', '{' + NS['pic'] + '}cNvPr'):
                                metadata.append({'locator': paths[child], 'kind': 'document-properties' if child.tag.endswith('}docPr') else 'picture-properties', 'altText': child.get('descr'), 'title': child.get('title')})
                            elif child.tag == '{' + NS['a'] + '}srcRect':
                                crops.append({'locator': paths[child], 'attributes': dict(child.attrib)})
                            elif child.tag == '{' + NS['wp'] + '}extent':
                                extents.append({'locator': paths[child], 'attributes': dict(child.attrib)})
                    if kind == 'vml':
                        metadata.append({'locator': locator, 'kind': 'vml-properties', 'altText': container.get('alt') if container is not None else None, 'title': node.get('{urn:schemas-microsoft-com:office:office}title')})
                        crops.append({'locator': locator, 'attributes': {key: node.attrib[key] for key in ('cropleft', 'cropright', 'croptop', 'cropbottom') if key in node.attrib}})
                    alternative = next((a.tag.rsplit('}', 1)[-1] for a in ancestors if a.tag in ('{' + NS['mc'] + '}Choice', '{' + NS['mc'] + '}Fallback')), None)
                    if alternative or kind == 'svg-alternative':
                        issue('alternative-representation-not-rendered', name, locator)
                    report['placements'].append({'placementId': sha((document['sha256'] + '\n' + name + '\n' + locator).encode()),
                        'part': name, 'locator': locator, 'relationshipId': rid, 'kind': kind, 'status': status,
                        'target': relation['target'] if relation else None, 'memberPath': target,
                        'sha256': item['sha256'] if item and status == 'resolved' else None,
                        'alternative': alternative, 'metadata': metadata, 'crops': crops, 'extents': extents})
            for name in sorted(media_names - referenced):
                issue('media-member-without-resolved-placement', name)
            for name in sorted(image_targets - set(members)):
                issue('image-relationship-target-missing', target=name)
            for part in sorted(set(relations) - {p['part'] for p in report['placements']}):
                if any(rel and rel['type'] in (IMAGE_REL, STRICT_IMAGE_REL) for rel in relations[part].values()):
                    issue('image-relationships-without-supported-placement', part)
        gate('verify-source')
        require(same_stat(original, os.fstat(handle.fileno())) and same_stat(original, os.stat(path, follow_symlinks=False)))
        require(file_hash(handle, gate) == document['sha256'])
        require(same_stat(original, os.fstat(handle.fileno())))
    report['counts'] = {'mediaMembers': len(report['media']), 'distinctByteAssets': len({(m['sha256'], m['size']) for m in report['media']}),
        'storedPlacements': len(report['placements']), 'resolvedPlacements': sum(p['status'] == 'resolved' for p in report['placements']),
        'renderedPlacements': None}
    require(len(json.dumps(report, ensure_ascii=True).encode()) <= MAX_REPORT)
    gate('complete')
    return report


def main():
    os.umask(0o077)
    resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 ** 2,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (600, 600))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    config = json.loads(sys.stdin.buffer.readline(16385))
    require(set(config) == {'sourcePath', 'document'})

    def gate(phase):
        print(json.dumps({'type': 'authorize', 'phase': phase}), flush=True)
        answer = json.loads(sys.stdin.buffer.readline(1025))
        require(set(answer) == {'allowed'} and answer['allowed'] is True)

    result = scan_docx(config['sourcePath'], config['document'], gate)
    print(json.dumps({'type': 'result', 'result': result}, ensure_ascii=True, separators=(',', ':')), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"type":"rejected"}', flush=True)
        sys.exit(1)
