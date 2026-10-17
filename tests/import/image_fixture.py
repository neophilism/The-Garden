"""Generated OOXML only; never historical source evidence."""
import hashlib
import json
import os
import sys
import zipfile
from xml.sax.saxutils import escape, quoteattr

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
IMAGE_REL = NS['r'] + '/image'
TYPES = '''<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''


def drawing(rid='r1', alt='Recorded description — not an identity', title='Original title', crop=True):
    return '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="457200"/><wp:docPr id="1" name="Picture" descr=' + quoteattr(alt) + ' title=' + quoteattr(title) + '/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed=' + quoteattr(rid) + '/>' + ('<a:srcRect l="1000" t="0" r="0" b="500"/>' if crop else '') + '</pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'


def xml(body):
    return ('<w:document ' + ' '.join('xmlns:' + k + '=' + quoteattr(v) for k, v in NS.items()) + '><w:body>' + body + '</w:body></w:document>').encode()


def rels(records=None):
    records = records if records is not None else [('r1', 'media/a.png', 'Internal', IMAGE_REL)]
    return ('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ''.join('<Relationship Id=' + quoteattr(rid) + ' Target=' + quoteattr(target) + ' Type=' + quoteattr(kind) + ' TargetMode=' + quoteattr(mode) + '/>' for rid, target, mode, kind in records) + '</Relationships>').encode()


def make(path, body=None, relationships=None, media=None, extra=None):
    parts = {'[Content_Types].xml': TYPES.encode(), 'word/document.xml': xml(drawing() if body is None else body),
             'word/_rels/document.xml.rels': rels(relationships), 'word/media/a.png': b'synthetic exact image bytes'}
    if media is not None:
        del parts['word/media/a.png']
        parts.update(media)
    parts.update(extra or {})
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, value in parts.items():
            archive.writestr(name, value)
    with open(path, 'rb') as source:
        data = source.read()
    return {'sourcePath': os.path.abspath(path), 'document': {'editionId': 'synthetic-edition-1', 'documentId': 'synthetic-document-1', 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}}


if __name__ == '__main__':
    print(json.dumps(make(os.path.join(sys.argv[1], 'synthetic.docx'))))
