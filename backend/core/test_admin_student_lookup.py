"""Student lookup keeps personal autofill data behind the admin gate."""
import ast
from pathlib import Path
from contextlib import nullcontext
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

class StudentLookupTests(unittest.TestCase):
    def endpoint(self, forbidden=None):
        node=next(n for n in ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig')).body if isinstance(n,ast.FunctionDef) and n.name=='admin_candidate_students_api')
        node.decorator_list=[]
        cur=Mock();cur.fetchall.return_value=[('test-id','Test','','Student','BSIT','1','A','test@example.invalid','test-contact','')]
        env=dict(_require_admin=Mock(return_value=forbidden),connection=SimpleNamespace(cursor=lambda:nullcontext(cur)),JsonResponse=lambda value:dict(value))
        exec(compile(ast.Module(body=[node],type_ignores=[]),'<student lookup>','exec'),env)
        return env['admin_candidate_students_api'],cur

    def test_admin_search_parameterized_and_limited(self):
        endpoint,cur=self.endpoint()
        response=endpoint(SimpleNamespace(GET={'q':"Test' OR 1=1"}))
        self.assertEqual(response['students'][0]['student_id'],'test-id')
        sql,params=cur.execute.call_args.args
        self.assertIn('LIMIT 15',sql)
        self.assertNotIn("Test' OR 1=1",sql)
        self.assertEqual(params,["%Test' OR 1=1%"]*2)
        self.assertEqual(response['Cache-Control'],'private, no-store')

    def test_non_admin_never_queries_profiles(self):
        forbidden={'ok':False}
        # A real forbidden response is truthy; empty dicts are not Django responses.
        endpoint,cur=self.endpoint(forbidden)
        self.assertIs(endpoint(SimpleNamespace()),forbidden)
        cur.execute.assert_not_called()

    def test_short_queries_skip_database(self):
        endpoint,cur=self.endpoint()
        self.assertEqual(endpoint(SimpleNamespace(GET={'q':'a'})),{'ok':True,'students':[]})
        cur.execute.assert_not_called()
