import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('archive_collect',pathlib.Path(__file__).with_name('collect.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class ArchiveTests(unittest.TestCase):
 def test_year_bounds(self):
  self.assertEqual(list(c.YEARS),list(range(2000,2026)))
 def test_matrix(self):
  s=c.summarize([],[]);self.assertEqual(len(s['coverage']),78)
  self.assertFalse(s['complete']);self.assertTrue(all(x['expectedDistinctEditions'] is None for x in s['coverage']))
 def test_partial_not_published(self):
  r=c.candidate('https://gaokao.eol.cn/2000.html','2000年高考语文试题','x')
  self.assertFalse(r['examReady']);self.assertFalse(r['ragEnabled']);self.assertFalse(r['completePaperVerified'])
 def test_exclude_simulation(self):
  for t in ['2025年数学模拟题','2024年英语适应性测试','2025语文满分作文','2026年高考数学试题','1999年高考英语试题']:
   self.assertIsNone(c.candidate('https://gaokao.eol.cn/a.html',t,'x'))
 def test_no_ambiguous_year_guess(self):
  self.assertIsNone(c.metadata('2000—2003年数学合集')['year'])
 def test_keep_tracks(self):
  self.assertEqual(c.metadata('2005年数学文科')['track'],'文科')
  self.assertEqual(c.metadata('2005年数学理科')['track'],'理科')
 def test_url_guard(self):
  for u in ['https://127.0.0.1/a','file:///etc/passwd','https://gaokao.eol.cn.evil.test/a','https://user:pass@gaokao.eol.cn/a','https://gaokao.eol.cn:8443/a','https://api.github.com/user','https://raw.githubusercontent.com/other/repo/main/a.pdf']:
   with self.assertRaises(ValueError):c.canonical(u)
 def test_fragment_dedupe(self):
  self.assertEqual(c.canonical('https://gaokao.eol.cn/a#1'),c.canonical('https://gaokao.eol.cn/a#2'))
 def test_not_pdf_by_extension(self):
  with self.assertRaises(ValueError):c.file_kind(b'<html>login</html>')
 def test_signature(self):
  self.assertEqual(c.file_kind(b'%PDF-1.7\nfixture\n%%EOF'),'pdf')
  with self.assertRaises(ValueError):c.file_kind(b'%PDF-1.7\ntruncated')
 def test_chinese_encoding(self):
  raw='<html><meta charset="gb2312">2000年语文</html>'.encode('gb18030')
  self.assertIn('2000年语文',c.decode(raw))
 def test_parser(self):
  p=c.Parser();p.feed('<title>2000语文</title><a href="/a" title="原卷">试题</a><img src="/x.jpg"><audio src="/x.mp3">')
  self.assertEqual(p.title,'2000语文');self.assertEqual(len(p.links),2);self.assertEqual(p.images[0]['url'],'/x.jpg')
 def test_source_not_paper_count(self):
  r=c.candidate('https://gaokao.eol.cn/a','2001年英语答案','x');r['status']='PAGE_SAVED'
  s=c.summarize([r],[]);self.assertEqual(s['counts']['pagesSaved'],1);self.assertEqual(s['counts']['verifiedPapers'],0)
 def test_dedupe_actual_assets(self):
  r=c.candidate('https://gaokao.eol.cn/a','2001年英语答案','x');r['assets']=[{'sha256':'a'*64,'bytes':9},{'sha256':'a'*64,'bytes':9}]
  self.assertEqual(c.summarize([r],[])['counts']['assetBytes'],9)
if __name__=='__main__':unittest.main()
