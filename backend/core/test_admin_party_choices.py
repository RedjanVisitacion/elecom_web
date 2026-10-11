import ast
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import unittest

class AdminPartyChoicesTests(unittest.TestCase):
    def endpoint(self, forbidden=None):
        tree=ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8-sig'))
        function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='admin_candidate_parties_api')
        function.decorator_list=[]
        cur=Mock();cur.fetchall.return_value=[('UNITE',),('unite',)]
        env=dict(_require_admin=Mock(return_value=forbidden),_ensure_candidate_applications_table=Mock(),
                 _ensure_election_scoped_tables=Mock(),_active_election_id=lambda:7,
                 connection=SimpleNamespace(cursor=lambda:nullcontext(cur)),JsonResponse=dict,
                 party_key=lambda v:v.lower(),party_rows=Mock(return_value=[('UNITE','private-hash','private-code','logo')]),
                 canonical_logo=Mock(return_value='https://example.invalid/logo.png'))
        exec(compile(ast.Module(body=[function],type_ignores=[]),'<admin parties>','exec'),env)
        return env['admin_candidate_parties_api'],cur

    def test_election_scoped_deduplicated_choices_without_codes(self):
        endpoint,cur=self.endpoint();result=endpoint(SimpleNamespace())
        self.assertEqual(result['parties'],[{'name':'UNITE','logo_url':'https://example.invalid/logo.png'}])
        self.assertEqual(cur.execute.call_args.args[1],[7,7])
        self.assertNotIn('private-code',str(result))
        self.assertEqual(result['Cache-Control'],'private, no-store')

    def test_non_admin_cannot_read_choices(self):
        denied={'ok':False};endpoint,cur=self.endpoint(denied)
        self.assertIs(endpoint(SimpleNamespace()),denied)
        cur.execute.assert_not_called()
