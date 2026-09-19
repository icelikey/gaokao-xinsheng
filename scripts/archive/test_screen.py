import copy,unittest
from screen_inventory import screen

def fixture(title='2012年高考英语试题及答案'):
    return {'schemaVersion':'archive-inventory/1','complete':False,'records':[{'id':'test','title':title,'year':2012,'subject':'英语','provider':'eol','status':'DISCOVERED','assets':[],'examReady':False,'ragEnabled':False,'contentVerified':False}]}
class ScreenTests(unittest.TestCase):
 def test_original_candidate_remains_unverified(self):
  x,q=screen(fixture());self.assertEqual(len(x['records']),1);self.assertEqual(q['records'],[]);self.assertFalse(x['records'][0]['contentVerified'])
 def test_mock_titles_are_separate(self):
  for t in ['2015年高三英语期末试卷','2014年高考英语二模','2016年语文复习练习','2012年师范生公费教育']:
   x,q=screen(fixture(t));self.assertEqual(len(x['records']),0);self.assertEqual(len(q['records']),1)
 def test_actual_page_heading_can_flag_false_link(self):
  f=fixture('试题');f['records'][0]['pageTitle']='公费教育实施办法';x,q=screen(f);self.assertEqual(len(q['records']),1)
 def test_preserves_input_and_evidence(self):
  f=fixture('高三期末英语试题');old=copy.deepcopy(f);x,q=screen(f);self.assertEqual(f,old);self.assertEqual(q['records'][0]['id'],'test')
 def test_cannot_promote_by_screening(self):
  f=fixture();f['records'][0]['examReady']=True
  with self.assertRaises(ValueError):screen(f)
 def test_matrix_counts_exclude_quarantine(self):
  f=fixture('2012年英语一模');x,q=screen(f);self.assertEqual(len(x['coverage']),78);self.assertEqual(sum(c['sources'] for c in x['coverage']),0);self.assertEqual(x['counts']['quarantinedNonTargetSources'],1)
if __name__=='__main__':unittest.main()
