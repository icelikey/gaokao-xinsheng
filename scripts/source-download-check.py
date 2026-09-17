import importlib.util, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('source_fetch',Path(__file__).with_name('acquire-exam-source.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
URL='https://www.eeafj.cn/u/cms/default/201206/example.jpg'
class Checks(unittest.TestCase):
    def test_allowed(self): self.assertTrue(m.allowed(URL))
    def test_host_boundary(self):
        for url in ['http://www.eeafj.cn/u/cms/default/201206/a.jpg','https://evil.test/x.jpg','file:///etc/passwd',URL+'?next=1','https://u:p@www.eeafj.cn/u/cms/default/201206/a.jpg']:
            self.assertFalse(m.allowed(url))
    def test_receipt(self):
        with tempfile.TemporaryDirectory() as p:
            result=m.acquire({'id':'fixture','assets':[{'id':'a','url':URL}]},Path(p),downloader=lambda _:b'\xff\xd8\xffexample\xff\xd9')
            self.assertTrue(result['complete']);self.assertFalse(result['humanVerified']);self.assertEqual(len(result['assets'][0]['sha256']),64)
    def test_failures_are_explicit(self):
        def fail(_):raise OSError('timeout')
        with tempfile.TemporaryDirectory() as p:
            result=m.acquire({'id':'fixture','assets':[{'id':'a','url':URL}]},Path(p),downloader=fail)
            self.assertFalse(result['complete']);self.assertIsNone(result['assets'][0]['sha256']);self.assertFalse(list(Path(p).glob('*.jpg')))
    def test_path_traversal(self):
        with tempfile.TemporaryDirectory() as p:
            with self.assertRaises(ValueError):m.acquire({'id':'fixture','assets':[{'id':'../a','url':URL}]},Path(p))
    def test_html_error_page(self):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*a):pass
            def geturl(self):return URL
            def read(self,*a):return b'<html>error</html>'
        class Opener:
            def open(self,*a,**k):return Response()
        with self.assertRaises(OSError):m.fetch_jpeg(URL,opener=Opener(),attempts=1)
if __name__=='__main__':unittest.main()
