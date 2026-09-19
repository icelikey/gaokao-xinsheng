import unittest,io,zipfile
import followup as f
class FollowupTests(unittest.TestCase):
 def test_published_pagination(self):
  pages=f.page_urls('https://gaokao.eol.cn/shiti/yw/','var _PAGE_COUNT = "20";')
  self.assertEqual(len(pages),19);self.assertEqual(pages[-1],'https://gaokao.eol.cn/shiti/yw/index_19.shtml')
 def test_no_invented_pagination(self):
  self.assertEqual(f.page_urls('https://gaokao.eol.cn/shiti/yw/','nothing'),[])
 def test_pagination_cap(self):
  self.assertEqual(len(f.page_urls('https://gaokao.eol.cn/shiti/yy/','_PAGE_COUNT="100000"')),39)
 def test_sina_year_not_inferred_from_publication(self):
  r=f.candidate('https://edu.sina.com.cn/l/2003-06-08/45073.html','语文','fixture')
  self.assertEqual(r['subject'],'语文');self.assertIsNone(r['year']);self.assertFalse(r['examReady'])
 def test_zip_not_extracted(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w') as z:z.writestr('readme.txt','original test only')
  self.assertEqual(f.bundle_kind(b.getvalue()),'zip')
 def test_zip_traversal_rejected(self):
  b=io.BytesIO()
  with zipfile.ZipFile(b,'w') as z:z.writestr('../outside.txt','x')
  with self.assertRaises(ValueError):f.bundle_kind(b.getvalue())
if __name__=='__main__':unittest.main()
