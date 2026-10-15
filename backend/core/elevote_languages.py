"""Language-aware local help for EleVote when the model is unavailable.

This is a small intent-based fallback, not a translation model. Never infer live
election dates, results, account eligibility, or a successful vote from a message.
"""
import re
import unicodedata

LANGUAGE_INSTRUCTIONS = (
    "Understand English, Bisaya (Cebuano), Tagalog/Filipino, and code-switched "
    "messages such as Bislish and Taglish. Reply in the language of the user's "
    "latest question unless they explicitly request another language. Use natural, "
    "simple Bisaya or Tagalog, not an English-only response. Recognize informal "
    "spellings and typos: 'unsaog pag vote?' / 'unsaon pagboto?' and 'paano "
    "bonoto?' / 'paano bumoto?' mean 'How do I vote?'. Keep actual app button "
    "and tab names (Vote Now, Election, Receipt, Results, Submit ballot) unchanged "
    "so the voter can find them. Do not reject an understandable question just "
    "because its language or spelling is informal. For truly ambiguous questions, "
    "ask one short clarification in the same language. All existing election, "
    "privacy, and factual-accuracy rules apply equally in every language. "
)


def _normalized(message):
    return ' '.join(unicodedata.normalize('NFKC', str(message or '')).lower().split())


def support_language(message):
    text = _normalized(message)
    words = set(re.findall(r"[a-z]+", text))
    if words & {'bisaya', 'cebuano', 'binisaya'}:
        return 'bisaya'
    if re.search(r'\bwala (?:pa )?akong\b', text):
        return 'tagalog'
    if words & {'tagalog', 'filipino'}:
        return 'tagalog'
    bisaya = words & {'unsa', 'unsay', 'unsaon', 'unsao', 'unsaog', 'ngano',
                      'nganong', 'asa', 'kinsa', 'dili', 'diay', 'palihog',
                      'kaayo', 'koy', 'nako', 'akong', 'imong', 'makaboto',
                      'moboto', 'muboto', 'botar', 'muvote'}
    tagalog = words & {'paano', 'pano', 'panu', 'bakit', 'saan', 'sino', 'hindi',
                       'kailangan', 'bumoto', 'bonoto', 'makaboto', 'pakisabi',
                       'po', 'opo', 'naman', 'nasaan', 'asan', 'aking', 'iyong'}
    # Question words are stronger than possessives shared by mixed-language chat.
    bisaya_score = len(bisaya) + 3 * len(words & {'unsa', 'unsay', 'unsaon', 'unsao', 'unsaog', 'ngano', 'nganong', 'asa', 'kinsa'})
    tagalog_score = len(tagalog) + 3 * len(words & {'paano', 'pano', 'panu', 'bakit', 'saan', 'sino', 'nasaan', 'asan'})
    if bisaya and bisaya_score >= tagalog_score:
        return 'bisaya'
    if tagalog:
        return 'tagalog'
    return 'english'


REPLIES = {
    'bisaya': {
        'vote': 'Aron makaboto, i-tap ang Vote Now sa Home o ablihi ang Election tab samtang bukas ang eleksyon. Konektaha ang awtorisadong campus network kung gikinahanglan, ug kompletoha ang face verification kung pangayoon. Pilia ang mga kandidato, susiha ang imong mga gipili, dayon i-tap ang Submit ballot. Dili na mausab ang boto human ma-submit.',
        'change_vote': 'Dili na mausab ang boto human ma-submit ang ballot. Susiha una ang tanang napiling kandidato sa dili pa i-tap ang Submit ballot.',
        'receipt': 'Ablihi ang Receipt tab human moboto. Kung wala pa ang resibo, hulat kadiyot ug i-refresh. Mogawas kini kung narekord na sa server ang imong ballot.',
        'results': 'Ablihi ang Results tab. Makita ang opisyal nga resulta kung ipagawas na kini sa ELECOM. Dili ko makakumpirma sa kasamtangang resulta dinhi.',
        'network': 'Kung gikinahanglan ang network restriction, konektaha ang awtorisadong campus network aron makaboto. Kung blocked gihapon, kontaka ang ELECOM aron masusi ang imong network.',
        'face': 'Para sa face verification, gamita ang hayag nga lugar, ibutang ang imong nawong sa tunga sa camera, ug ayaw kini taboni. Kung mapakyas gihapon, kontaka ang ELECOM support.',
        'filing': 'Ablihi ang Candidate Filing gikan sa Home ug kompletoha ang gikinahanglang detalye ug Certificate of Candidacy. Ang ELECOM maoy mosusi sa imong kwalipikasyon ug mga dokumento. Kung rehistrado na ka nga kandidato sa maong eleksyon, dili na ka mahimong mo-file pag-usab.',
        'candidates': 'Ang app mopakita sa mga kandidato nga puwede nimong botohan base sa imong profile, sama sa USG ug imong organisasyon. Kung sayop ang makita, ipa-check sa ELECOM ang imong program ug account details.',
        'password': 'Sa login screen, pilia ang Forgot Password ug sundon ang mga lakang sa OTP ug pag-ilis sa password. Ayaw ipaambit ang imong OTP o password. Kung wala moabot ang code, kontaka ang ELECOM support.',
        'logout': 'Aron mo-log out, ablihi ang Account/Profile tab, i-tap ang Logout, ug kumpirmaha. Kinahanglan ka mo-log in pag-usab aron magamit ang imong account.',
        'profile': 'Ablihi ang Account/Profile tab para sa account details, settings, notifications, FAQs, ug Contact Support.',
        'about': 'Ang ELECOM mao ang campus election system sa USTP Oroquieta. Ang EleVote mao ang AI assistant sulod sa ELECOM app nga motabang sa pagboto ug paggamit sa app.',
        'greeting': 'Maayong adlaw! Makatabang ko sa pagboto, kandidatura, face verification, resibo, ug resulta. Unsay imong pangutana?',
        'thanks': 'Walay sapayan! Kung naa pa kay pangutana bahin sa ELECOM, pangutana lang.',
        'unknown': 'Makatabang ko sa Bisaya bahin sa pagboto, kandidatura, face verification, resibo, ug resulta. Unsang bahin ang imong kinahanglan og tabang?',
    },
    'tagalog': {
        'vote': 'Para bumoto, i-tap ang Vote Now sa Home o buksan ang Election tab habang bukas ang eleksyon. Kumonekta sa awtorisadong campus network kung kailangan at kumpletuhin ang face verification kung hihingin. Piliin ang mga kandidato, suriin ang iyong mga pinili, at i-tap ang Submit ballot. Hindi na mababago ang boto pagkatapos isumite.',
        'change_vote': 'Hindi na mababago ang boto kapag naisumite na ang ballot. Suriin muna ang lahat ng napiling kandidato bago i-tap ang Submit ballot.',
        'receipt': 'Buksan ang Receipt tab pagkatapos bumoto. Kung wala pa ang resibo, maghintay sandali at mag-refresh. Lalabas ito kapag naitala na ng server ang iyong ballot.',
        'results': 'Buksan ang Results tab. Makikita ang opisyal na resulta kapag inilabas na ito ng ELECOM. Hindi ko makukumpirma ang kasalukuyang resulta rito.',
        'network': 'Kung kailangan ang network restriction, kumonekta sa awtorisadong campus network para bumoto. Kung blocked pa rin, makipag-ugnayan sa ELECOM upang masuri ang iyong network.',
        'face': 'Para sa face verification, pumunta sa maliwanag na lugar, itapat ang mukha sa gitna ng camera, at huwag itong takpan. Kung hindi pa rin gumana, makipag-ugnayan sa ELECOM support.',
        'filing': 'Buksan ang Candidate Filing mula sa Home at kumpletuhin ang mga detalye at Certificate of Candidacy. ELECOM ang susuri sa iyong kwalipikasyon at mga dokumento. Kung rehistradong kandidato ka na sa eleksyong iyon, hindi ka na maaaring mag-file muli.',
        'candidates': 'Ipinapakita ng app ang mga kandidatong maaari mong botohan batay sa iyong profile, gaya ng USG at iyong organisasyon. Kung mali ang nakikita, ipasuri sa ELECOM ang iyong program at account details.',
        'password': 'Sa login screen, piliin ang Forgot Password at sundin ang mga hakbang para sa OTP at pagpapalit ng password. Huwag ibahagi ang iyong OTP o password. Kung hindi dumating ang code, makipag-ugnayan sa ELECOM support.',
        'logout': 'Para mag-log out, buksan ang Account/Profile tab, i-tap ang Logout, at kumpirmahin. Kailangan mong mag-log in muli para magamit ang iyong account.',
        'profile': 'Buksan ang Account/Profile tab para sa account details, settings, notifications, FAQs, at Contact Support.',
        'about': 'Ang ELECOM ang campus election system ng USTP Oroquieta. Ang EleVote ang AI assistant sa loob ng ELECOM app na tumutulong sa pagboto at paggamit ng app.',
        'greeting': 'Magandang araw! Makakatulong ako sa pagboto, kandidatura, face verification, resibo, at resulta. Ano ang iyong tanong?',
        'thanks': 'Walang anuman! Magtanong lang kung kailangan mo pa ng tulong tungkol sa ELECOM.',
        'unknown': 'Makakatulong ako sa Tagalog tungkol sa pagboto, kandidatura, face verification, resibo, at resulta. Saang bahagi mo kailangan ng tulong?',
    },
}


def localized_fallback_reply(message, *, language=None):
    language = language or support_language(message)
    if language == 'english':
        return None  # Preserve the existing English help responses.
    text = _normalized(message)
    words = set(re.findall(r'[a-z]+', text))
    def has(*terms):
        return bool(words.intersection(terms))
    voting = has('vote', 'votes', 'voting', 'boto', 'bumoto', 'bonoto', 'poboto', 'magboto',
                 'pagboto', 'makaboto', 'moboto', 'muboto', 'botar', 'muvote', 'ballot')
    if voting and has('change', 'usab', 'usbon', 'ilisan', 'ilis', 'baguhin', 'palitan', 'mabago', 'mausab'):
        intent = 'change_vote'
    elif has('otp', 'password', 'reset', 'forgot', 'nakalimutan', 'nalimot'):
        intent = 'password'
    elif has('receipt', 'resibo'):
        intent = 'receipt'
    elif has('result', 'results', 'resulta', 'daog', 'nidaog', 'nanalo'):
        intent = 'results'
    elif has('face', 'verification', 'selfie', 'mukha', 'nawong', 'camera'):
        intent = 'face'
    elif has('network', 'wifi', 'internet', 'blocked', 'koneksyon'):
        intent = 'network'
    elif has('filing', 'file', 'coc', 'requirements', 'kwalipikasyon', 'kandidatura', 'modagan', 'tumakbo', 'maging'):
        intent = 'filing'
    elif has('candidate', 'candidates', 'kandidato', 'kandidata'):
        intent = 'candidates'
    elif has('logout') or 'log out' in text:
        intent = 'logout'
    elif has('profile', 'account', 'settings'):
        intent = 'profile'
    elif voting:
        intent = 'vote'
    elif has('salamat', 'thanks', 'thank'):
        intent = 'thanks'
    elif has('hello', 'hi', 'kumusta', 'kamusta', 'maayong', 'magandang'):
        intent = 'greeting'
    elif has('elecom', 'elevote', 'ecvs'):
        intent = 'about'
    else:
        intent = 'unknown'
    return REPLIES[language][intent]
