"""Source-grounded ELECOM support knowledge and bounded conversation helpers.

No private account data, provider credentials, or live election values belong here.
See docs/elevote-support.md for the mobile sources and validation workflow.
"""
import re

from .elevote_languages import _normalized, localized_fallback_reply, support_language

SUPPORT_BEHAVIOR = (
    "You are EleVote, the support assistant inside the ELECOM app for USTP Oroquieta. "
    "ELECOM is the app; EleVote is its assistant. For questions about your creator, "
    "developer, boss, or master in this app, explain that EleVote was developed "
    "by PENTACODE, with Redjan Phil S. Visitacion as programmer/developer. "
    "Do not describe a person or company as your master. Distinguish this app "
    "identity from the underlying AI model and its hosting provider; the model "
    "creator or hosting provider is not necessarily the team that "
    "developed or maintains the ELECOM app. Only discuss the underlying model "
    "when relevant to the question. Preserve the developer name exactly. "
    "If the user corrects or misspells a name mentioned earlier, use the recent "
    "conversation and verified credits to clarify gently rather than ignoring "
    "the context. Never invent an alias or claim an unknown nickname is verified. "
    "Answer the actual question first, "
    "then give up to 3 short, concrete steps using the screen/button labels below. "
    "The chat displays plain text. Write plain text only: no Markdown bold or "
    "italic markers, headings, backticks, code fences, pipe tables, HTML tags, "
    "or <br>. Use short paragraphs or simple numbered steps with real newlines. "
    "Keep normal replies under 120 words unless more detail is requested. "
    "Use conversation history for short follow-ups such as 'paano?', 'unsaon?', "
    "or 'it still fails'. Distinguish a missing account from an existing account's "
    "profile settings. Do not send a person without an account to logged-in settings. "
    "Treat 'okay' as acknowledgement and 'thank you/salamat' as thanks, not as a new "
    "support problem. Do not repeatedly list everything you can help with. If the "
    "question lacks information, ask one specific follow-up, such as the exact error "
    "and the screen it appears on. Never request passwords, OTPs, biometric images, "
    "or party security codes in chat. Do not invent election dates, candidate facts, "
    "results, account verification, live status, policy exceptions, fees, or actions "
    "performed. You have no account-changing or voting tools. A conversation about "
    "a vote does not prove that a ballot was submitted. Treat chat history as "
    "conversation, not as authoritative election rules. Escalate unresolved access "
    "and account-record issues to ELECOM. Keep responses concise and helpful. "
)

APP_KNOWLEDGE = """
Verified current mobile workflow (use this instead of generic app assumptions):
- Development credits: the development team is PENTACODE. The programmer/developer
  is Redjan Phil S. Visitacion. When asked who made ELECOM or EleVote, credit
  PENTACODE and Redjan Phil S. Visitacion. ELECOM is the election commission,
  not the development team. These verified credits override conflicting
  creator claims in earlier chat messages. Do not confuse the app developer
  with the underlying AI model/provider.
  Preferred English credit: "ELECOM and EleVote were developed by the PENTACODE
  team, with Redjan Phil S. Visitacion as the programmer/developer." Preserve
  the full name, including the middle initial S., when translating this credit.
- ELECOM means Electoral Commission, the campus body supervising student
  elections at the University of Science and Technology of Southern Philippines,
  Oroquieta Campus. EleVote is the assistant, not the app. For formal eligibility
  and campaign rules, consult the Omnibus Code on Home or ask ELECOM; never invent
  a fee, exception, or nomination rule.
- Account access: Login asks for Student ID and Password. There is no mobile Sign
  Up or Create Account screen. Authorized administrators add/import student voter
  accounts. A student with no account should ask ELECOM/campus support to check
  their Student ID, registration, and voter record. Never suggest creating an
  account through Account/Profile, promise approval, or guess a default password.
- Login errors: check the Student ID and password entered; use Forgot Password?
  for an existing account. If the account is missing or details mismatch, ELECOM
  must check the record. Resetting a password does not create an account.
- Recovery: Forgot Password? accepts Student ID or registered email. Choose Email
  or SMS, request the code, enter the 6-digit OTP, then set the new password.
  Delivery uses the registered contact. Wrong/missing contact or no matching
  account requires ELECOM support. Use the newest OTP after a resend; follow the
  displayed resend cooldown and expiry rather than inventing a fixed duration.
- Home: election countdown, Vote Now/View Receipt/View Results, Calendar of
  Activities, candidate list/search, Candidate Filing card, and EleVote chat.
  Calendar changes refresh automatically while Home is visible. Read dates from
  the actual calendar/countdown; you cannot confirm live dates from this guide.
- Face enrollment: the first-login flow may open enrollment before the dashboard.
  Tap Start face enrollment, allow camera access, center the face in good light,
  and follow blink/slow left/right head-turn prompts. Existing face enrollment
  and pre-vote face verification are different steps. Do not advise registering
  the same face to another account or bypassing verification.
- Voting: start with Vote Now on Home while voting is open. An authorized campus
  network is required only when restriction is enabled. Complete requested face
  verification. Select candidates in the eligible ballot, review, then Submit
  ballot. Submitted ballots cannot be changed. A plain Election tab visit may
  show election information without starting the verification/ballot flow.
- Eligible ballot: USG plus the student's eligible department/organization;
  SITE, PAFE, and AFPROTECHS are campus organizations. Missing/wrong candidates
  can require checking program/year/section with ELECOM. Do not assert an
  individual's eligibility without their verified record.
- Straight party voting is optional. It fills available slate positions; review
  and adjust selections before submission. Never recommend a candidate or party.
- Receipt: after submission, open Receipt or View Receipt. If unavailable, wait
  briefly and refresh; do not tell the user to submit another ballot. The server's
  receipt/vote status is the confirmation, not the chat assistant.
- Results: Results/View Results only shows official results when released. A
  countdown, unpublished page, and a final election result are not interchangeable.
  Transparency shows ledger hashes and integrity status; a hash match alone is
  not proof of integrity. Do not claim a Merkle proof is available.
- Candidate Filing: Home card, account Student ID, candidate details, required
  2x2 candidate photo, organization/position, platform, signature and COC. Program
  and year/section have account restrictions. Memberships are optional. Initial
  filing review is not final candidacy approval. Initial Filing Approved permits
  the follow-up PDFs: Certificate of Enrollment, Grades — Last 2 Semesters (one
  PDF), and Good Moral Certificate; each is at most 8 MB. Requirements Under
  Review waits for final ELECOM approval; final approval publishes the candidate.
  Filing Rejected may allow correction through File Again. Requirements Rejected
  after follow-up review does not allow another filing for that election. Follow
  the actual status screen. An already registered candidate cannot file again
  for the same election, including for a different position.
- Certificate: View / Save Certificate loads the server's filed PDF edition.
  Download opens the device's native save dialog. Print Certificate has Open
  device print options; the phone owns the printer dialog (Back/Cancel exits).
- Profile/settings: Me opens the profile; Account Settings > Personal Information
  shows profile details. Some identity/program/year fields are restricted; ask
  ELECOM to correct them. Settings includes appearance and notification settings;
  push also needs device notification permission. A denied permission does not
  mean an event or filing decision was not saved. Logout is in Account/Profile.
- Human help: Contact Support in FAQs/About offers Messenger and Email. The
  current support links are https://m.me/redjan.phil.s.visitacion and
  rpsvcodes@gmail.com. An admin takeover pauses AI; admins reply in this chat.
  You cannot initiate takeover yourself or promise response times.
- Distribution: the current app is distributed as an official Android APK.
  Do not claim it is available on Google Play or the Apple App Store, or give
  iOS-specific instructions as though an iOS release exists. For reinstalling,
  use the official APK link provided by ELECOM; do not invent a download URL.
- APK update: install an official newer APK over the existing app using Update.
  Do not recommend uninstalling first. An update prompt needs a higher published
  build, a reachable update endpoint, and an APK containing the checker. The
  displayed version name alone (e.g. 1.0.0) does not identify its build number.
"""


def previous_turns(history, message):
    """Bound history and avoid repeating the current message saved before inference."""
    turns = [dict(item) for item in list(history or [])[-12:] if isinstance(item, dict)]
    if turns and turns[-1].get('role') == 'user' and _normalized(turns[-1].get('content')) == _normalized(message):
        turns.pop()
    return turns


def build_chat_messages(system_prompt, history, message):
    messages = [{'role': 'system', 'content': system_prompt}]
    for item in previous_turns(history, message):
        role = item.get('role')
        if role not in {'user', 'assistant', 'admin'}:
            continue
        content = str(item.get('content') or '').strip()
        if content:
            messages.append({'role': 'assistant' if role == 'admin' else role, 'content': content[:2000]})
    messages.append({'role': 'user', 'content': str(message or '')[:2000]})
    return messages


HELP = {
    'results': {
        'english': 'Official election results appear in the Results tab only when ELECOM releases them. I cannot confirm the release date from this chat. Open Results/View Results for the current publication status, or ask ELECOM for the announcement schedule.',
        'tagalog': 'Lalabas ang opisyal na resulta sa Results tab kapag inilabas na ito ng ELECOM. Hindi ko makukumpirma rito ang petsa ng release. Buksan ang Results/View Results para sa kasalukuyang publication status, o itanong sa ELECOM ang iskedyul ng anunsyo.',
        'bisaya': 'Makita ang opisyal nga resulta sa Results tab kung ipagawas na kini sa ELECOM. Dili ko makakumpirma dinhi sa petsa sa release. Ablihi ang Results/View Results para sa kasamtangang publication status, o pangutan-a ang ELECOM sa iskedyul sa anunsyo.',
    },
    'accuracy': {
        'english': 'The AI service is unavailable right now, so this is limited app guidance rather than a live information check. I cannot verify election announcements or account records here. Which statement looks incorrect? For an official result or schedule, check Results or ask ELECOM.',
        'tagalog': 'Hindi available ngayon ang AI service, kaya pangkalahatang gabay sa app lang ito at hindi live na pag-verify ng impormasyon. Hindi ko masusuri rito ang anunsyo o account record. Aling pahayag ang mali? Para sa opisyal na resulta o iskedyul, tingnan ang Results o itanong sa ELECOM.',
        'bisaya': 'Dili available karon ang AI service, mao nga kinatibuk-ang giya sa app lang kini ug dili live nga pagsusi sa impormasyon. Dili nako masusi dinhi ang anunsyo o account record. Unsang pahayag ang sayop? Para sa opisyal nga resulta o iskedyul, tan-awa ang Results o pangutan-a ang ELECOM.',
    },
    'no_account': {
        'english': 'There is no self-service Sign Up in ELECOM. Ask your ELECOM administrator to check or add your student voter record using your Student ID. If you already have an account but forgot the password, use Forgot Password? on Login. Do not share your password or OTP in chat.',
        'tagalog': 'Walang sariling Sign Up sa ELECOM app. Makipag-ugnayan sa ELECOM administrator para ma-check o maidagdag ang iyong student voter record gamit ang Student ID. Kung may account ka na pero nakalimutan ang password, gamitin ang Forgot Password? sa Login. Huwag ibahagi rito ang password o OTP.',
        'bisaya': 'Walay kaugalingong Sign Up sa ELECOM app. Kontaka ang ELECOM administrator aron ma-check o madugang ang imong student voter record gamit ang Student ID. Kung naa na kay account pero nalimot sa password, gamita ang Forgot Password? sa Login. Ayaw ipaambit dinhi ang password o OTP.',
    },
    'login': {
        'english': 'On Login, check your Student ID and password. For a forgotten password, tap Forgot Password?. If your account is missing or the record is incorrect, ask ELECOM to check it. What exact error appears?',
        'tagalog': 'Sa Login, tingnan kung tama ang Student ID at password. Kung nakalimutan ang password, i-tap ang Forgot Password?. Kung walang account o mali ang record, ipasuri ito sa ELECOM. Ano ang eksaktong error na lumalabas?',
        'bisaya': 'Sa Login, susiha kung sakto ang Student ID ug password. Kung nalimot sa password, i-tap ang Forgot Password?. Kung walay account o sayop ang record, ipa-check kini sa ELECOM. Unsay eksaktong error nga makita?',
    },
    'otp_missing': {
        'english': 'Check whether you selected Email or SMS and whether the masked contact belongs to you. Check spam for email; for SMS, check phone signal and messages. Follow the displayed resend cooldown and use only the newest code. If the contact is wrong or no code arrives, contact ELECOM. Never share the OTP here.',
        'tagalog': 'Tingnan kung Email o SMS ang pinili at kung sa iyo ang masked contact. Tingnan ang spam kung email; kung SMS, tingnan ang signal at messages. Sundin ang resend cooldown at gamitin lamang ang pinakabagong code. Kung mali ang contact o walang dumarating, kontakin ang ELECOM. Huwag ibahagi rito ang OTP.',
        'bisaya': 'Tan-awa kung Email o SMS ang gipili ug kung imo ba ang masked contact. Susiha ang spam kung email; kung SMS, susiha ang signal ug messages. Sunda ang resend cooldown ug gamita lang ang pinakabag-ong code. Kung sayop ang contact o walay code nga moabot, kontaka ang ELECOM. Ayaw ipaambit dinhi ang OTP.',
    },
    'requirements': {
        'english': 'After Initial Filing Approved, open your filing and upload three PDFs: Certificate of Enrollment, Grades — Last 2 Semesters in one PDF, and Good Moral Certificate. Each file must be at most 8 MB. Requirements Under Review means ELECOM still needs to give final approval.',
        'tagalog': 'Pagkatapos ng Initial Filing Approved, buksan ang filing at i-upload ang tatlong PDF: Certificate of Enrollment, Grades — Last 2 Semesters sa isang PDF, at Good Moral Certificate. Hanggang 8 MB bawat file. Kapag Requirements Under Review, hinihintay pa ang final approval ng ELECOM.',
        'bisaya': 'Human sa Initial Filing Approved, ablihi ang filing ug i-upload ang tulo ka PDF: Certificate of Enrollment, Grades — Last 2 Semesters sa usa ka PDF, ug Good Moral Certificate. Hangtod 8 MB matag file. Ang Requirements Under Review nagpasabot nga naghulat pa sa final approval sa ELECOM.',
    },
    'rejection': {
        'english': 'Read the rejection reason in Candidate Filing. An initial Filing Rejected may allow corrections with File Again. Requirements Rejected after follow-up review does not allow another filing for that election. Which status is shown?',
        'tagalog': 'Basahin ang rejection reason sa Candidate Filing. Ang unang Filing Rejected ay maaaring payagang itama gamit ang File Again. Ang Requirements Rejected pagkatapos ng follow-up review ay hindi puwedeng i-file muli para sa eleksyong iyon. Aling status ang nakikita mo?',
        'bisaya': 'Basaha ang rejection reason sa Candidate Filing. Ang unang Filing Rejected mahimong matul-id gamit ang File Again. Ang Requirements Rejected human sa follow-up review dili na mahimong i-file pag-usab sa maong eleksyon. Unsang status ang imong makita?',
    },
    'certificate': {
        'english': 'Open Candidate Filing and tap View / Save Certificate. Download lets you choose where to save the PDF. For printing, open Print Certificate, then Open device print options. Use the phone’s Back/Cancel control to leave the printer dialog.',
        'tagalog': 'Buksan ang Candidate Filing at i-tap ang View / Save Certificate. Sa Download, piliin kung saan ise-save ang PDF. Para mag-print, buksan ang Print Certificate, pagkatapos Open device print options. Gamitin ang Back/Cancel ng phone para lumabas sa printer dialog.',
        'bisaya': 'Ablihi ang Candidate Filing ug i-tap ang View / Save Certificate. Sa Download, pilia asa i-save ang PDF. Para mag-print, ablihi ang Print Certificate, dayon Open device print options. Gamita ang Back/Cancel sa phone aron mogawas sa printer dialog.',
    },
    'notification': {
        'english': 'In Me/Profile, open Settings and notification settings. Enable Push Notifications and allow notifications in your phone’s ELECOM app settings. Check the notification bell for in-app updates. Push delivery also depends on connectivity and server setup.',
        'tagalog': 'Sa Me/Profile, buksan ang Settings at notification settings. I-enable ang Push Notifications at payagan ang notifications sa ELECOM app settings ng phone. Tingnan din ang notification bell para sa in-app updates. Kailangan din ng koneksyon at tamang server setup ang push.',
        'bisaya': 'Sa Me/Profile, ablihi ang Settings ug notification settings. I-enable ang Push Notifications ug tugoti ang notifications sa ELECOM app settings sa phone. Susiha usab ang notification bell para sa in-app updates. Nagdepende usab ang push sa koneksyon ug server setup.',
    },
    'calendar': {
        'english': 'Check Calendar of Activities and the election countdown on Home for the current dates. Calendar changes refresh while Home is visible. I cannot confirm live dates from this chat; contact ELECOM if the displayed schedule seems incorrect.',
        'tagalog': 'Tingnan ang Calendar of Activities at election countdown sa Home para sa kasalukuyang petsa. Nagre-refresh ang calendar habang nakabukas ang Home. Hindi ko makukumpirma rito ang live dates; kontakin ang ELECOM kung mukhang mali ang schedule.',
        'bisaya': 'Tan-awa ang Calendar of Activities ug election countdown sa Home para sa kasamtangang mga petsa. Mo-refresh ang calendar samtang makita ang Home. Dili ko makakumpirma dinhi sa live dates; kontaka ang ELECOM kung murag sayop ang schedule.',
    },
    'support': {
        'english': 'Use Contact Support in FAQs/About for Messenger or Email. You can also describe your issue here for ELECOM’s support inbox. An administrator may take over this conversation; I cannot promise a response time.',
        'tagalog': 'Gamitin ang Contact Support sa FAQs/About para sa Messenger o Email. Maaari mo ring ilahad dito ang problema para sa support inbox ng ELECOM. Maaaring kunin ng administrator ang usapan; hindi ko maipapangako ang oras ng tugon.',
        'bisaya': 'Gamita ang Contact Support sa FAQs/About para sa Messenger o Email. Mahimo usab nimong isulti dinhi ang problema para sa support inbox sa ELECOM. Mahimong motubag ang administrator sa usapan; dili ko makasaad sa oras sa pagtubag.',
    },
    'update': {
        'english': 'Download the newer official APK and install it over ELECOM by choosing Update. Do not uninstall first. If there is no update prompt, fully close and reopen the app. The installed build and server’s published build must differ; the version name alone does not show that.',
        'tagalog': 'I-download ang mas bagong opisyal na APK at i-install sa kasalukuyang ELECOM gamit ang Update. Huwag munang mag-uninstall. Kung walang prompt, isara nang tuluyan at buksan muli ang app. Build number ang tinitingnan, hindi lang ang version name.',
        'bisaya': 'I-download ang mas bag-ong opisyal nga APK ug i-install ibabaw sa kasamtangang ELECOM gamit ang Update. Ayaw una pag-uninstall. Kung walay prompt, sirad-i pag-ayo ug ablihi pag-usab ang app. Build number ang gisusi, dili lang ang version name.',
    },
    'ack': {'english': 'You’re welcome. Ask if you need help with the next step.', 'tagalog': 'Sige! Magtanong lang kung kailangan mo ng tulong sa susunod na hakbang.', 'bisaya': 'Sige! Pangutana lang kung kinahanglan nimo og tabang sa sunod nga lakang.'},
    'clarify': {'english': 'Which screen and exact error do you see now? Do not send your password or OTP.', 'tagalog': 'Saang screen at ano ang eksaktong error na nakikita mo ngayon? Huwag ipadala ang password o OTP.', 'bisaya': 'Unsang screen ug eksaktong error ang imong makita karon? Ayaw ipadala ang password o OTP.'},
}


def support_topic(message):
    text = _normalized(message)
    words = set(re.findall(r'[a-z]+', text))
    if re.search(r'not accurate|inaccurate|wrong answer|incorrect|not correct|mali|sayop', text):
        return 'accuracy'
    # A results announcement is not the voting countdown/calendar.
    if words & {'result', 'results', 'resulta', 'winner', 'winners'}:
        return 'results'
    if ('account' in words or 'akawnt' in words or 'signup' in words or 'register' in words) and (
        re.search(r"wala|walay|no account|don.?t have|do not have|without|missing|not found|not registered|create|register|sign.?up|himo|gawa|gumawa", text)
    ):
        return 'no_account'
    if re.search(r'log.?in|sign.?in|makapasok|maka.?login|makasulod', text):
        return 'login'
    if words & {'otp', 'code'} and re.search(r'wala|di |hindi|not|missing|arriv|abot|dating|receive|resend', text):
        return 'otp_missing'
    if words & {'rejected', 'reject', 'rejection', 'gi reject', 'tinanggihan'}:
        return 'rejection'
    if 'certificate' in words and words & {'save', 'download', 'print'}:
        return 'certificate'
    if words & {'pdf', 'requirements', 'grades', 'enrollment', 'cor', 'moral'}:
        return 'requirements'
    if words & {'notification', 'notifications', 'push', 'bell'}:
        return 'notification'
    if words & {'calendar', 'schedule', 'countdown', 'event', 'events', 'petsa'} or re.search(r'when.*elect|kanus.a.*ele|kailan.*ele', text):
        return 'calendar'
    if words & {'support', 'admin', 'human', 'tao', 'tawo', 'contact', 'messenger'}:
        return 'support'
    if words & {'apk', 'update', 'upgrade', 'install'}:
        return 'update'
    if words & {'vote', 'voting', 'boto', 'poboto', 'bumoto', 'bonoto', 'pagboto', 'magboto', 'moboto', 'muboto', 'botar'}:
        return 'vote'
    if words & {'receipt', 'resibo'}:
        return 'receipt'
    if words & {'result', 'results', 'resulta'}:
        return 'results'
    if words & {'password', 'reset', 'otp'}:
        return 'password'
    if words & {'face', 'selfie', 'verification'}:
        return 'face'
    if words & {'network', 'wifi', 'internet'}:
        return 'network'
    if words & {'filing', 'file', 'coc', 'kandidatura'}:
        return 'filing'
    return None


def contextual_fallback_reply(message, history=None):
    text = _normalized(message)
    turns = previous_turns(history, message)
    language = support_language(message)
    neutral = bool(re.fullmatch(r"(ok|okay|okey|sige|yes|no|salamat|thanks|thank you|how|paano|paano po|pano|unsaon|then|next|what next|still not working)[.!? ]*", text))
    if neutral and language == 'english':
        for item in reversed(turns):
            if item.get('role') == 'user':
                prior_language = support_language(item.get('content'))
                if prior_language != 'english':
                    language = prior_language
                    break
    if re.fullmatch(r'(ok|okay|okey|sige|salamat|thanks|thank you)[.!? ]*', text):
        return HELP['ack'][language]
    if neutral and text.rstrip('.!? ') in {'no', 'still not working'}:
        return HELP['clarify'][language]
    topic = support_topic(message)
    if language == 'english' and topic == 'vote' and re.search(r'\b(change|edit|replace)\b', text):
        return 'No. After your ballot is submitted, you cannot change your vote. Review every selected candidate before pressing Submit ballot.'
    if topic is None and neutral:
        for item in reversed(turns):
            if item.get('role') == 'user':
                topic = support_topic(item.get('content'))
                if topic:
                    break
    if topic in HELP:
        return HELP[topic][language]
    if topic and neutral:
        # Expand a short follow-up into the previous topic for local intent help.
        if language == 'english':
            return {
                'vote': 'To vote, tap Vote Now on Home while voting is open. Complete any required network and face checks, choose candidates, review, then Submit ballot. A submitted ballot cannot be changed.',
                'password': 'Tap Forgot Password? on Login, enter your Student ID or registered email, choose Email or SMS, verify the newest 6-digit OTP, and set your new password. Never share the OTP here.',
                'receipt': 'Open Receipt or View Receipt after voting. If the receipt is missing, wait briefly and refresh; do not submit another ballot. Ask ELECOM to check if it remains unavailable.',
                'results': 'Open Results/View Results. Official results appear only when released by ELECOM; I cannot confirm live winners here.',
                'face': 'Allow camera access, use good lighting, and follow the face capture prompts. If verification still fails, tell ELECOM the exact error; do not bypass it.',
                'network': 'Use the authorized campus network if restriction is enabled. If blocked, ask ELECOM to check your network rather than repeatedly submitting a vote.',
                'filing': 'Open Candidate Filing on Home, complete the COC, and submit for initial review. Follow the status screen for supporting PDFs and final approval. An existing candidate cannot file again for the same election.',
            }.get(topic)
        return localized_fallback_reply(topic, language=language)
    return localized_fallback_reply(message, language=language)


def current_date_context(now=None):
    """Supply a fresh Philippine date and time for each AI request."""
    from datetime import datetime, timezone, timedelta
    philippine_time = timezone(timedelta(hours=8))
    if now is None:
        now = datetime.now(timezone.utc)
    local = now.astimezone(philippine_time)
    return (
        "\nCurrent date in the Philippines (UTC+08:00): "
        + local.strftime("%A, %B %d, %Y (%Y-%m-%d)")
        + ". Current Philippine time (Asia/Manila, UTC+08:00): "
        + local.strftime("%I:%M %p")
        + ". This timestamp was captured when this request started. For current "
        "date/time questions, use these values exactly; do not guess or use "
        "timestamps from earlier messages. The time is already converted to "
        "Philippine time; do not add or subtract eight hours again. "
        "This is not an election schedule or "
        "confirmation of any result release date.\n"
    )
