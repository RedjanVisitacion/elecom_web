"""Local language support tests; never call the AI provider or send messages."""
import ast
from pathlib import Path
import unittest

from core.elevote_languages import LANGUAGE_INSTRUCTIONS, localized_fallback_reply, support_language

tree = ast.parse(Path(__file__).with_name('views.py').read_text(encoding='utf-8'))
node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_elevote_fallback_reply')
ns = {'__name__': 'core.views', '__package__': 'core'}
exec(compile(ast.Module(body=[node], type_ignores=[]), '<fallback>', 'exec'), ns)
reply = ns['_elevote_fallback_reply']


class LanguageTests(unittest.TestCase):
    def test_screenshot_tagalog_typo_gets_voting_steps(self):
        text = reply('paano bonoto?')
        self.assertIn('Para bumoto', text)
        self.assertIn('Vote Now', text)
        self.assertIn('Submit ballot', text)
        self.assertNotIn('Please ask your question again', text)

    def test_screenshot_bisaya_typo_gets_voting_steps(self):
        text = reply('unsaog pag vote?')
        self.assertIn('Aron makaboto', text)
        self.assertIn('Election', text)
        self.assertIn('Submit ballot', text)

    def test_mixed_case_spacing_and_code_switching(self):
        for message in ('UNSAON   PAGBOTO SA ELECOM?', 'unsaon mag vote sa ELECOM app?', 'asa ko moboto?'):
            self.assertIn('Aron makaboto', reply(message))
        for message in ('Paano bumoto sa ELECOM?', 'pano mag vote po?', 'panu magboto?'):
            self.assertIn('Para bumoto', reply(message))

    def test_action_has_priority_over_app_name(self):
        self.assertIn('Receipt tab', reply('asa ang resibo sa ELECOM?'))
        self.assertIn('Results tab', reply('saan ang resulta sa ELECOM?'))

    def test_both_languages_preserve_no_vote_changes_rule(self):
        self.assertIn('Dili na mausab', reply('pwede usbon akong boto?'))
        self.assertIn('Hindi na mababago', reply('paano palitan ang boto?'))

    def test_face_and_network_questions_in_both_languages(self):
        self.assertIn('face verification', reply('ngano dili mo work ang face verification?'))
        self.assertIn('face verification', reply('bakit hindi gumagana ang face verification?'))
        self.assertIn('campus network', reply('unsaon kung blocked ang wifi?'))
        self.assertIn('campus network', reply('bakit blocked ang wifi ko?'))

    def test_filing_help_keeps_duplicate_candidate_rule(self):
        self.assertIn('dili na', reply('unsaon pag file sa kandidatura?'))
        self.assertIn('hindi ka na', reply('paano maging kandidato?'))

    def test_otp_help_never_requests_code(self):
        self.assertIn('Ayaw ipaambit', reply('wala koy OTP'))
        self.assertIn('Huwag ibahagi', reply('bakit wala ang OTP ko?'))

    def test_results_help_does_not_invent_winner(self):
        self.assertIn('Dili ko makakumpirma', reply('kinsa nidaog?'))
        self.assertIn('Hindi ko makukumpirma', reply('sino ang nanalo?'))

    def test_english_answers_preserved(self):
        self.assertIsNone(localized_fallback_reply('How do I vote?'))
        self.assertIn('To vote, tap Vote Now', reply('How do I vote?'))
        self.assertIn('cannot change your vote', reply('Can I change my vote?'))

    def test_unknown_question_clarifies_in_same_language(self):
        self.assertIn('Unsang bahin', reply('unsa ni nga butang?'))
        self.assertIn('Saang bahagi', reply('paano ito?'))

    def test_prompt_supplies_multilingual_instructions_to_model(self):
        groq = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == '_elevote_groq_reply')
        messages = next(n.value for n in groq.body if isinstance(n, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == 'messages' for t in n.targets))
        prompt = eval(compile(ast.Expression(messages), '<prompt>', 'eval'), {'LANGUAGE_INSTRUCTIONS': LANGUAGE_INSTRUCTIONS})[0]['content']
        for term in ('Bisaya', 'Tagalog', 'latest question', 'paano bonoto?', 'do not invent'):
            self.assertIn(term.lower(), prompt.lower())
        self.assertEqual(support_language('hello'), 'english')


if __name__ == '__main__': unittest.main()
