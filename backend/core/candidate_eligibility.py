"""Candidate eligibility shared by admin student lookup and direct registration."""

def normalize_program(value):
    value = str(value or '').strip().upper()
    if 'BFPT' in value:
        return 'BFPT'
    if 'BTLED' in value:
        return 'BTLED'
    if 'BSIT' in value or 'INFORMATION TECHNOLOGY' in value or value == 'IT' or ' IT' in value:
        return 'BSIT'
    return None


def allowed_organizations(program):
    return {'BSIT':['USG','SITE'], 'BTLED':['USG','PAFE'], 'BFPT':['USG','AFPROTECHS']}.get(normalize_program(program), [])


def validate_student_eligibility(cur, payload):
    cur.execute("""SELECT COALESCE(s.course,u.department,'') FROM users u
        LEFT JOIN student s ON s.id_number::text=u.student_id::text
        WHERE u.student_id::text=%s AND LOWER(COALESCE(u.role,''))='student'""", [str(payload.get('student_id') or '').strip()])
    row = cur.fetchone()
    if not row:
        raise ValueError('Select an existing student account to register this candidate.')
    program = normalize_program(row[0])
    if not program:
        raise ValueError('Update this student account with a supported program before registering a candidate.')
    if normalize_program(payload.get('program')) != program:
        raise ValueError('The candidate program must match the selected student account.')
    organization = str(payload.get('organization') or '').upper().strip()
    if organization == 'AFPRO':
        organization = 'AFPROTECHS'
    if organization not in allowed_organizations(program):
        raise ValueError(f'{program} students may run only for '+ ' or '.join(allowed_organizations(program))+'.')
    position = str(payload.get('position') or '').strip()
    if 'representative' in position.lower() and (organization != 'USG' or position.lower() != f'{program} Representative'.lower()):
        raise ValueError('Students may run only for their own program representative position in USG.')
    return program
