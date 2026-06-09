// Election Page - Multi-step Voting Flow: Select → Review → Confirm → Receipt
(function() {
    'use strict';

    const API_BALLOT = '/api/ballot/';
    const API_VOTE_SUBMIT = '/api/vote/submit/';
    const API_VOTE_STATUS = '/api/vote/status/';
    const API_NETWORK_CHECK = '/api/network/check/';

    // State
    const state = {
        selections: {},
        ballotData: null,
        candidatesMap: new Map(),
        straightParties: {},
        straightVoteCollapsed: true,
        collapsedOrgs: new Set(),
        isSubmitting: false,
        hasVoted: false
    };

    // DOM Elements
    const elements = {
        ballotRoot: document.getElementById('ballotRoot'),
        straightVoteRoot: document.getElementById('straightVoteRoot'),
        ballotLoading: document.getElementById('ballotLoading'),
        ballotSubtitle: document.getElementById('ballotSubtitle'),
        ballotProgramLine: document.getElementById('ballotProgramLine'),
        eligibleOrgLine: document.getElementById('eligibleOrgLine'),
        ballotHint: document.getElementById('ballotHint'),
        selectedCount: document.getElementById('selectedCount'),
        reviewBallotBtn: document.getElementById('reviewBallotBtn'),
        reviewModal: document.getElementById('reviewModal'),
        reviewContent: document.getElementById('reviewContent'),
        reviewTotalCount: document.getElementById('reviewTotalCount'),
        reviewOrgCount: document.getElementById('reviewOrgCount'),
        confirmBallotBtn: document.getElementById('confirmBallotBtn'),
        confirmModal: document.getElementById('confirmModal'),
        backToReviewBtn: document.getElementById('backToReviewBtn'),
        finalSubmitBtn: document.getElementById('finalSubmitBtn'),
        processingModal: document.getElementById('processingModal')
    };

    // Bootstrap Modal Instances
    let modals = {};

    const initModals = () => {
        if (elements.reviewModal) {
            modals.review = new bootstrap.Modal(elements.reviewModal);
        }
        if (elements.confirmModal) {
            modals.confirm = new bootstrap.Modal(elements.confirmModal);
        }
        if (elements.processingModal) {
            modals.processing = new bootstrap.Modal(elements.processingModal);
        }
    };

    const isMultiSelectPosition = (positionKey) => {
        const k = String(positionKey || '').toUpperCase();
        return k.startsWith('USG::') && k.includes('REPRESENTATIVE');
    };

    const getTotalSelectedCount = () => {
        return Object.values(state.selections).reduce((acc, v) => {
            if (Array.isArray(v)) return acc + v.length;
            if (v === null || v === undefined || v === '') return acc;
            return acc + 1;
        }, 0);
    };

    const updateSelectedCount = () => {
        const count = getTotalSelectedCount();
        if (elements.selectedCount) {
            elements.selectedCount.textContent = count;
        }
        if (elements.reviewBallotBtn) {
            elements.reviewBallotBtn.disabled = count === 0;
        }
    };

    const refreshCandidateUi = () => {
        document.querySelectorAll('.candidate-option').forEach((wrap) => {
            const input = wrap.querySelector('input');
            wrap.classList.toggle('selected', !!input?.checked);
            wrap.classList.remove('disabled');
            if (input) input.disabled = false;
        });

        Object.keys(state.selections).forEach((positionKey) => {
            if (!isMultiSelectPosition(positionKey)) return;
            const selected = Array.isArray(state.selections[positionKey]) ? state.selections[positionKey] : [];
            const hasTwo = selected.length >= 2;
            document.querySelectorAll(`input[name="pos_${positionKey}"]`).forEach((input) => {
                if (!input.checked) {
                    input.disabled = hasTwo;
                    input.closest('.candidate-option')?.classList.toggle('disabled', hasTwo);
                }
            });
        });
    };

    const syncInputsFromSelections = () => {
        document.querySelectorAll('#ballotRoot input[type="radio"], #ballotRoot input[type="checkbox"]').forEach((input) => {
            const positionKey = String(input.name || '').replace(/^pos_/, '');
            const selected = state.selections[positionKey];
            const cid = Number(input.value);
            input.checked = Array.isArray(selected) ? selected.includes(cid) : Number(selected) === cid;
        });
        refreshCandidateUi();
        updateSelectedCount();
    };

    const updateProgressStep = (step) => {
        document.querySelectorAll('.progress-step').forEach(el => {
            el.classList.remove('active', 'completed');
            if (el.dataset.step === step) {
                el.classList.add('active');
            } else if (isStepBefore(el.dataset.step, step)) {
                el.classList.add('completed');
            }
        });

        document.querySelectorAll('.progress-connector').forEach((el, index) => {
            const steps = ['select', 'review', 'confirm', 'receipt'];
            const currentIndex = steps.indexOf(step);
            el.classList.toggle('active', index < currentIndex);
        });
    };

    const isStepBefore = (step1, step2) => {
        const steps = ['select', 'review', 'confirm', 'receipt'];
        return steps.indexOf(step1) < steps.indexOf(step2);
    };

    const storeCandidateInfo = (candidate) => {
        state.candidatesMap.set(String(candidate.id), {
            id: candidate.id,
            name: candidate.name || 'Candidate',
            party_name: candidate.party_name || '',
            photo_url: candidate.photo_url || null
        });
    };

    const getCandidateInfo = (id) => {
        return state.candidatesMap.get(String(id)) || { id, name: 'Unknown Candidate', party_name: '', photo_url: null };
    };

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[ch]);

    const normalizeOrg = (org) => {
        const up = String(org || 'USG').trim().toUpperCase();
        if (up === 'AFPRO' || up === 'AFPROTECHS' || up.includes('AFPRO')) return 'AFPRO';
        if (up.includes('SITE')) return 'SITE';
        if (up.includes('PAFE')) return 'PAFE';
        if (up.includes('USG')) return 'USG';
        return up || 'USG';
    };

    const orgDisplayName = (org) => ({
        USG: 'University Student Government (USG)',
        SITE: 'Society of Information Technology Enthusiasts (SITE)',
        PAFE: 'Prime Association of Future Educators (PAFE)',
        AFPRO: 'Association of Food Processing Technology Students (AFPROTECHS)',
    })[normalizeOrg(org)] || String(org || 'Organization');

    const orgLogoUrl = (org) => ({
        USG: '/static/assets/org_logos/USG_LOGO.png',
        SITE: '/static/assets/org_logos/SITE_LOGO.png',
        PAFE: '/static/assets/org_logos/PAFE_LOGO.png',
        AFPRO: '/static/assets/org_logos/AFPROTECHS_LOGO.png',
    })[normalizeOrg(org)] || '/static/assets/elecom.png';

    const buildCandidateOption = ({ positionKey, candidate }) => {
        storeCandidateInfo(candidate);

        const wrap = document.createElement('label');
        wrap.className = 'candidate-option';

        const isMulti = isMultiSelectPosition(positionKey);

        const input = document.createElement('input');
        input.type = isMulti ? 'checkbox' : 'radio';
        input.name = `pos_${positionKey}`;
        input.value = String(candidate.id);
        input.className = 'form-check-input';

        const avatar = document.createElement('div');
        avatar.className = 'candidate-avatar';
        if (candidate.photo_url) {
            const img = document.createElement('img');
            img.src = candidate.photo_url;
            img.alt = '';
            avatar.appendChild(img);
        } else {
            const i = document.createElement('i');
            i.className = 'bi bi-person-circle';
            avatar.appendChild(i);
        }

        const info = document.createElement('div');
        info.className = 'candidate-info';

        const name = document.createElement('div');
        name.className = 'candidate-name';
        name.textContent = candidate.name || 'Candidate';

        const party = document.createElement('div');
        party.className = 'candidate-party';
        party.textContent = candidate.party_name ? String(candidate.party_name) : '';

        info.appendChild(name);
        if (party.textContent) info.appendChild(party);

        const check = document.createElement('div');
        check.className = 'candidate-check';
        check.innerHTML = '<i class="bi bi-check-lg"></i>';

        wrap.appendChild(input);
        wrap.appendChild(avatar);
        wrap.appendChild(info);
        wrap.appendChild(check);

        // Event listener for selection
        input.addEventListener('change', () => {
            const cid = Number(candidate.id);
            if (!Number.isFinite(cid)) return;

            wrap.classList.toggle('selected', input.checked);

            if (!isMulti) {
                // Single select - unselect others
                const all = document.querySelectorAll(`input[name="pos_${positionKey}"]`);
                all.forEach((el) => {
                    if (el !== input) {
                        el.checked = false;
                        el.closest('.candidate-option')?.classList.remove('selected');
                    }
                });
                state.selections[positionKey] = input.checked ? cid : null;
                if (!input.checked) delete state.selections[positionKey];
            } else {
                // Multi select - handle array
                const cur = state.selections[positionKey];
                const arr = Array.isArray(cur) ? cur.slice() : [];

                if (input.checked) {
                    if (arr.length >= 2) {
                        input.checked = false;
                        wrap.classList.remove('selected');
                        return;
                    }
                    if (!arr.includes(cid)) arr.push(cid);
                } else {
                    const idx = arr.indexOf(cid);
                    if (idx >= 0) arr.splice(idx, 1);
                }

                if (!arr.length) {
                    delete state.selections[positionKey];
                } else {
                    state.selections[positionKey] = arr;
                }

                // Update disabled state for other checkboxes
                const all = document.querySelectorAll(`input[name="pos_${positionKey}"]`);
                const hasTwo = Array.isArray(state.selections[positionKey]) && state.selections[positionKey].length >= 2;
                all.forEach((el) => {
                    if (!el.checked) {
                        el.disabled = hasTwo;
                        if (hasTwo) {
                            el.closest('.candidate-option')?.classList.add('disabled');
                        } else {
                            el.closest('.candidate-option')?.classList.remove('disabled');
                        }
                    }
                });
            }

            updateSelectedCount();
            delete state.straightParties[positionKey.split('::')[0]];
            updateStraightVoteActive();
        });

        // Click handler on input itself to enable unselecting radio buttons
        input.addEventListener('click', (e) => {
            const cid = Number(candidate.id);
            if (!Number.isFinite(cid)) return;

            // For radio buttons (single select), allow unselecting by clicking again
            if (!isMulti && input.checked) {
                const isSelected = Number(state.selections[positionKey]) === cid;
                if (isSelected) {
                    e.preventDefault();
                    input.checked = false;
                    wrap.classList.remove('selected');
                    delete state.selections[positionKey];
                    updateSelectedCount();
                }
            }
        });

        // Unified click handler for the entire card
        wrap.addEventListener('click', (e) => {
            const cid = Number(candidate.id);
            if (!Number.isFinite(cid)) return;

            // If clicking directly on the input, let the change event handle it
            if (e.target === input || e.target.closest('input') === input) {
                return;
            }

            // For multi-select positions with 2 already selected, don't allow more
            if (isMulti) {
                const cur = state.selections[positionKey];
                const arr = Array.isArray(cur) ? cur : [];
                const hasTwo = arr.length >= 2;
                const isThisSelected = arr.includes(cid);
                if (hasTwo && !isThisSelected) {
                    e.preventDefault();
                    return; // Can't select more than 2
                }
            }

            // Check if this candidate is currently selected
            const isSelected = !isMulti 
                ? Number(state.selections[positionKey]) === cid
                : (Array.isArray(state.selections[positionKey]) && state.selections[positionKey].includes(cid));

            if (isSelected) {
                // Unselect this candidate
                e.preventDefault();
                input.checked = false;
                wrap.classList.remove('selected');

                if (!isMulti) {
                    delete state.selections[positionKey];
                } else {
                    const cur = state.selections[positionKey];
                    const arr = Array.isArray(cur) ? cur.slice() : [];
                    const idx = arr.indexOf(cid);
                    if (idx >= 0) arr.splice(idx, 1);
                    
                    if (!arr.length) {
                        delete state.selections[positionKey];
                    } else {
                        state.selections[positionKey] = arr;
                    }

                    // Update disabled state for other checkboxes
                    const all = document.querySelectorAll(`input[name="pos_${positionKey}"]`);
                    const hasTwo = Array.isArray(state.selections[positionKey]) && state.selections[positionKey].length >= 2;
                    all.forEach((el) => {
                        if (!el.checked) {
                            el.disabled = hasTwo;
                            if (hasTwo) {
                                el.closest('.candidate-option')?.classList.add('disabled');
                            } else {
                                el.closest('.candidate-option')?.classList.remove('disabled');
                            }
                        }
                    });
                }

                updateSelectedCount();
                delete state.straightParties[positionKey.split('::')[0]];
                updateStraightVoteActive();
            } else {
                // Select this candidate
                e.preventDefault();
                input.checked = true;
                input.dispatchEvent(new Event('change'));
            }
        });

        return wrap;
    };

    const getPartyKey = (value) => String(value || '').trim();

    const getStraightVoteGroups = (ballot) => {
        const groups = new Map();
        (ballot || []).forEach((orgBlock) => {
            const org = normalizeOrg(orgBlock.organization);
            if (!groups.has(org)) groups.set(org, new Map());
            const parties = groups.get(org);
            (orgBlock.positions || []).forEach((posBlock) => {
                (posBlock.candidates || []).forEach((candidate) => {
                    const party = getPartyKey(candidate.party_name);
                    if (!party) return;
                    const cur = parties.get(party) || { name: party, count: 0 };
                    cur.count += 1;
                    parties.set(party, cur);
                });
            });
        });
        return Array.from(groups.entries())
            .map(([org, parties]) => ({
                org,
                title: org === 'USG' ? 'USG Party' : `${org} Party`,
                parties: Array.from(parties.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
            }))
            .filter((group) => group.parties.length)
            .sort((a, b) => (a.org === 'USG' ? -1 : b.org === 'USG' ? 1 : a.org.localeCompare(b.org)));
    };

    const updateStraightVoteActive = () => {
        if (!elements.straightVoteRoot) return;
        elements.straightVoteRoot.querySelectorAll('[data-party]').forEach((btn) => {
            btn.classList.toggle('active', state.straightParties[btn.dataset.org] === btn.dataset.party);
        });
        updateStraightVoteSummary();
    };

    const getStraightVoteSummary = () => {
        const entries = Object.entries(state.straightParties);
        if (!entries.length) return 'Select one USG party and one organization party.';
        return entries
            .map(([org, party]) => `${org}: ${party}`)
            .join(' • ');
    };

    const updateStraightVoteSummary = () => {
        const summary = elements.straightVoteRoot?.querySelector('#straightVoteSummary');
        if (summary) summary.textContent = getStraightVoteSummary();
    };

    const clearSelections = () => {
        state.selections = {};
        state.straightParties = {};
        syncInputsFromSelections();
        updateStraightVoteActive();
    };

    const expandOrgSection = (orgName, focusCandidateId = null) => {
        const org = normalizeOrg(orgName);
        state.collapsedOrgs.delete(org);
        const section = elements.ballotRoot?.querySelector(`.org-section[data-org="${org}"]`);
        const header = section?.querySelector('.org-header');
        const body = section?.querySelector('.org-body');
        const icon = section?.querySelector('.org-chevron');
        if (body) body.hidden = false;
        if (header) header.setAttribute('aria-expanded', 'true');
        if (icon) {
            icon.classList.remove('bi-chevron-down');
            icon.classList.add('bi-chevron-up');
        }
        window.setTimeout(() => {
            const target = focusCandidateId
                ? section?.querySelector(`input[value="${CSS.escape(String(focusCandidateId))}"]`)?.closest('.candidate-option')
                : null;
            (target || header)?.scrollIntoView({ behavior: 'smooth', block: target ? 'center' : 'start' });
        }, 80);
    };

    const applyStraightVote = (orgName, partyName) => {
        if (!state.ballotData || !Array.isArray(state.ballotData.ballot)) return;
        const targetOrg = normalizeOrg(orgName);
        const targetParty = getPartyKey(partyName);
        if (!targetOrg || !targetParty) return;

        const nextSelections = { ...state.selections };
        Object.keys(nextSelections).forEach((key) => {
            if (key.split('::')[0] === targetOrg) delete nextSelections[key];
        });
        let firstMatchedCandidateId = null;
        state.ballotData.ballot.forEach((orgBlock) => {
            const org = normalizeOrg(orgBlock.organization);
            if (org !== targetOrg) return;

            (orgBlock.positions || []).forEach((posBlock) => {
                const pos = String(posBlock.position || '');
                const positionKey = `${org}::${pos}`;
                const matches = (posBlock.candidates || [])
                    .filter((candidate) => getPartyKey(candidate.party_name) === targetParty)
                    .map((candidate) => Number(candidate.id))
                    .filter(Number.isFinite);

                if (!matches.length) return;
                if (firstMatchedCandidateId === null) firstMatchedCandidateId = matches[0];
                nextSelections[positionKey] = isMultiSelectPosition(positionKey) ? matches.slice(0, 2) : matches[0];
            });
        });

        state.selections = nextSelections;
        state.straightParties[targetOrg] = targetParty;
        syncInputsFromSelections();
        updateStraightVoteActive();
        expandOrgSection(targetOrg, firstMatchedCandidateId);
    };

    const renderStraightVote = (ballot) => {
        if (!elements.straightVoteRoot) return;
        const groups = getStraightVoteGroups(ballot);
        if (!groups.length) {
            elements.straightVoteRoot.innerHTML = '';
            return;
        }

        const groupHtml = groups.map((group) => `
            <div class="straight-group">
                <div class="straight-group-title">${escapeHtml(group.title)}</div>
                <div class="straight-party-list">
                    ${group.parties.map((party) => `
                        <button type="button" class="straight-party-btn" data-org="${escapeHtml(group.org)}" data-party="${escapeHtml(party.name)}">
                            <span>${escapeHtml(party.name)}</span>
                            <small>${party.count} candidate${party.count !== 1 ? 's' : ''}</small>
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');

        elements.straightVoteRoot.innerHTML = `
            <section class="straight-vote-panel ${state.straightVoteCollapsed ? 'is-collapsed' : ''}" aria-label="Vote straight by party">
                <div class="straight-vote-head" id="straightVoteToggle" role="button" tabindex="0" aria-expanded="${state.straightVoteCollapsed ? 'false' : 'true'}">
                    <div>
                        <div class="straight-vote-title"><i class="bi bi-lightning-charge"></i> Vote Straight</div>
                        <p id="straightVoteSummary">${escapeHtml(getStraightVoteSummary())}</p>
                    </div>
                    <div class="straight-vote-actions">
                        <button type="button" class="straight-clear-btn" id="clearStraightVote">Clear</button>
                        <i class="bi ${state.straightVoteCollapsed ? 'bi-chevron-down' : 'bi-chevron-up'} straight-chevron" aria-hidden="true"></i>
                    </div>
                </div>
                <div class="straight-group-list" ${state.straightVoteCollapsed ? 'hidden' : ''}>${groupHtml}</div>
            </section>
        `;

        const toggleStraightVote = () => {
            state.straightVoteCollapsed = !state.straightVoteCollapsed;
            renderStraightVote(ballot);
        };
        const toggle = elements.straightVoteRoot.querySelector('#straightVoteToggle');
        toggle?.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            toggleStraightVote();
        });
        toggle?.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            toggleStraightVote();
        });
        elements.straightVoteRoot.querySelectorAll('[data-party]').forEach((button) => {
            button.addEventListener('click', () => applyStraightVote(button.dataset.org || '', button.dataset.party || ''));
        });
        elements.straightVoteRoot.querySelector('#clearStraightVote')?.addEventListener('click', clearSelections);
    };

    const renderBallot = (ballot) => {
        if (!elements.ballotRoot) return;
        elements.ballotRoot.innerHTML = '';
        renderStraightVote(ballot);
        state.collapsedOrgs = new Set(
            (ballot || [])
                .map((orgBlock) => normalizeOrg(orgBlock.organization))
                .filter(Boolean)
        );

        (ballot || []).forEach((orgBlock) => {
            const org = normalizeOrg(orgBlock.organization);
            if (!org) return;

            const orgSection = document.createElement('div');
            orgSection.className = 'org-section';
            orgSection.dataset.org = org;

            const orgHeader = document.createElement('div');
            orgHeader.className = `org-header org-header--${org.toLowerCase()}`;
            orgHeader.setAttribute('role', 'button');
            orgHeader.setAttribute('tabindex', '0');
            orgHeader.setAttribute('aria-expanded', state.collapsedOrgs.has(org) ? 'false' : 'true');
            orgHeader.innerHTML = `
                <span class="org-title-wrap">
                    <img class="org-logo" src="${escapeHtml(orgLogoUrl(org))}" alt="${escapeHtml(orgDisplayName(org))} logo" onerror="this.onerror=null;this.src='/static/assets/elecom.png';">
                    <span class="org-name">${escapeHtml(orgDisplayName(org))}</span>
                </span>
                <i class="bi ${state.collapsedOrgs.has(org) ? 'bi-chevron-down' : 'bi-chevron-up'} org-chevron" aria-hidden="true"></i>
            `;
            orgSection.appendChild(orgHeader);

            const orgBody = document.createElement('div');
            orgBody.className = 'org-body';
            orgBody.hidden = state.collapsedOrgs.has(org);

            const toggleOrg = () => {
                if (state.collapsedOrgs.has(org)) {
                    state.collapsedOrgs.delete(org);
                } else {
                    state.collapsedOrgs.add(org);
                }
                orgBody.hidden = state.collapsedOrgs.has(org);
                orgHeader.setAttribute('aria-expanded', state.collapsedOrgs.has(org) ? 'false' : 'true');
                const icon = orgHeader.querySelector('.org-chevron');
                if (icon) {
                    icon.classList.toggle('bi-chevron-down', state.collapsedOrgs.has(org));
                    icon.classList.toggle('bi-chevron-up', !state.collapsedOrgs.has(org));
                }
            };

            orgHeader.addEventListener('click', toggleOrg);
            orgHeader.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                toggleOrg();
            });

            (orgBlock.positions || []).forEach((posBlock) => {
                const pos = String(posBlock.position || '');
                const positionKey = `${org}::${pos}`;
                const isMulti = isMultiSelectPosition(positionKey);

                const positionCard = document.createElement('div');
                positionCard.className = 'card ballot-card mb-3';

                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';

                const posHeader = document.createElement('div');
                posHeader.className = 'position-header';
                posHeader.innerHTML = `
                    <span class="position-title">${pos}</span>
                    ${isMulti ? '<span class="position-badge">Select up to 2</span>' : '<span class="position-badge">Select 1</span>'}
                `;

                const candidatesList = document.createElement('div');
                candidatesList.className = 'd-grid gap-2';

                (posBlock.candidates || []).forEach((candidate) => {
                    candidatesList.appendChild(buildCandidateOption({ positionKey, candidate }));
                });

                cardBody.appendChild(posHeader);
                cardBody.appendChild(candidatesList);
                positionCard.appendChild(cardBody);
                orgBody.appendChild(positionCard);
            });

            orgSection.appendChild(orgBody);
            elements.ballotRoot.appendChild(orgSection);
        });
    };

    const openReviewModal = () => {
        const selections = state.selections;
        const totalCount = getTotalSelectedCount();

        // Count unique organizations
        const orgs = new Set();
        Object.keys(selections).forEach(key => {
            const org = key.split('::')[0];
            if (org) orgs.add(org);
        });

        if (elements.reviewTotalCount) {
            elements.reviewTotalCount.textContent = `${totalCount} candidate${totalCount !== 1 ? 's' : ''}`;
        }
        if (elements.reviewOrgCount) {
            elements.reviewOrgCount.textContent = orgs.size;
        }

        // Build review content
        let reviewHTML = '';

        if (state.ballotData && state.ballotData.ballot) {
            state.ballotData.ballot.forEach((orgBlock) => {
                const org = normalizeOrg(orgBlock.organization);
                if (!org) return;

                let hasSelections = false;
                let orgContent = '';

                (orgBlock.positions || []).forEach((posBlock) => {
                    const pos = String(posBlock.position || '');
                    const positionKey = `${org}::${pos}`;
                    const selectedIds = selections[positionKey];

                    if (!selectedIds || (Array.isArray(selectedIds) && selectedIds.length === 0)) return;

                    hasSelections = true;
                    const ids = Array.isArray(selectedIds) ? selectedIds : [selectedIds];

                    let candidatesHTML = '';
                    ids.forEach(id => {
                        const candidate = getCandidateInfo(id);
                        candidatesHTML += `
                            <div class="review-candidate">
                                <div class="review-candidate-avatar">
                                    ${candidate.photo_url 
                                        ? `<img src="${candidate.photo_url}" alt="">`
                                        : '<i class="bi bi-person-circle"></i>'
                                    }
                                </div>
                                <div class="review-candidate-info">
                                    <div class="review-candidate-name">${candidate.name}</div>
                                    ${candidate.party_name ? `<div class="review-candidate-party">${candidate.party_name}</div>` : ''}
                                </div>
                                <i class="bi bi-check-circle-fill review-check-icon"></i>
                            </div>
                        `;
                    });

                    orgContent += `
                        <div class="review-position">
                            <div class="review-position-title">${pos}</div>
                            ${candidatesHTML}
                        </div>
                    `;
                });

                if (hasSelections) {
                    reviewHTML += `
                        <div class="review-org-section">
                            <div class="review-org-header">${org}</div>
                            ${orgContent}
                        </div>
                    `;
                }
            });
        }

        if (elements.reviewContent) {
            elements.reviewContent.innerHTML = reviewHTML || '<p class="text-muted text-center">No selections made.</p>';
        }

        updateProgressStep('review');
        modals.review?.show();
    };

    const openConfirmModal = () => {
        modals.review?.hide();
        updateProgressStep('confirm');
        modals.confirm?.show();
    };

    const goBackToReview = () => {
        modals.confirm?.hide();
        updateProgressStep('review');
        modals.review?.show();
    };

    const submitVote = async () => {
        if (state.isSubmitting) return;
        state.isSubmitting = true;

        modals.confirm?.hide();
        modals.processing?.show();

        try {
            // First check network authorization
            const networkRes = await fetch(API_NETWORK_CHECK, {
                method: 'GET',
                credentials: 'same-origin'
            });

            const networkData = await networkRes.json().catch(() => ({ ok: true, allowed: true }));

            if (!networkData.ok || !networkData.allowed) {
                modals.processing?.hide();
                alert(networkData.message || 'You must be connected to the authorized network to vote. Please connect to the same network as the admin and try again.');
                state.isSubmitting = false;
                return;
            }

            // Network check passed, proceed with vote submission
            updateProgressStep('receipt');

            // Prepare selections
            const out = {};
            Object.entries(state.selections).forEach(([k, v]) => {
                if (isMultiSelectPosition(k)) {
                    if (Array.isArray(v)) out[k] = v.slice(0, 2);
                    return;
                }
                if (!Array.isArray(v)) out[k] = v;
            });

            const res = await fetch(API_VOTE_SUBMIT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ selections: out }),
            });

            const data = await res.json().catch(() => ({}));

            if (res.status === 401) {
                toLogin();
                return;
            }

            if (!res.ok || !data || data.ok !== true) {
                const msg = (data && data.error) ? data.error : 'Failed to submit vote.';
                modals.processing?.hide();
                alert(msg);
                state.isSubmitting = false;
                updateProgressStep('select');
                return;
            }

            // Success - store receipt data and redirect
            const receiptData = {
                selections: state.selections,
                candidates: Array.from(state.candidatesMap.entries()).reduce((acc, [id, info]) => {
                    acc[id] = info;
                    return acc;
                }, {}),
                ballotData: state.ballotData,
                referenceNumber: data.reference_number || generateReferenceNumber(),
                votedAt: new Date().toISOString(),
                totalSelections: getTotalSelectedCount()
            };

            sessionStorage.setItem('elecom_vote_receipt', JSON.stringify(receiptData));

            // Redirect to receipt page
            window.location.href = '/static/org_elecom/elecom_user/user_receipt.html';

        } catch (e) {
            modals.processing?.hide();
            alert('Failed to submit vote. Please try again.');
            state.isSubmitting = false;
            updateProgressStep('select');
        }
    };

    const generateReferenceNumber = () => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ELE-${timestamp}-${random}`;
    };

    const toLogin = () => {
        try {
            sessionStorage.removeItem('elecom_user');
        } catch (e) { /* ignore */ }
        window.location.href = '/login/';
    };

    const loadBallot = async () => {
        if (!elements.ballotRoot) return;

        if (elements.ballotLoading) {
            elements.ballotLoading.style.display = 'block';
        }

        try {
            const res = await fetch(API_BALLOT, { method: 'GET', cache: 'no-store' });
            const data = await res.json();

            if (res.status === 401) {
                toLogin();
                return;
            }

            const phase = String(data?.election?.vote_phase || '').toLowerCase();
            if (data?.code === 'election_not_active' || (phase && phase !== 'active')) {
                showVotingLockedUI(data.election, data.error);
                return;
            }

            if (!res.ok || !data || data.ok !== true) {
                throw new Error('Failed');
            }

            state.ballotData = data;

            const program = String(data.program_code || '').trim();
            if (program && elements.ballotProgramLine) {
                elements.ballotProgramLine.style.display = '';
                elements.ballotProgramLine.textContent = `Program: ${program}`;
            }

            const eligible = Array.isArray(data.eligible_organizations) ? data.eligible_organizations : [];
            if (elements.eligibleOrgLine && eligible.length) {
                elements.eligibleOrgLine.style.display = '';
                elements.eligibleOrgLine.textContent = `Eligible: ${eligible.join(', ')}`;
            }

            renderBallot(data.ballot || []);

            if (elements.ballotSubtitle) {
                elements.ballotSubtitle.textContent = 'Select candidates per position, then review and submit.';
            }
            if (elements.ballotHint) {
                elements.ballotHint.style.display = '';
            }

            updateSelectedCount();

        } catch (e) {
            if (elements.ballotSubtitle) {
                elements.ballotSubtitle.textContent = 'Unable to load ballot.';
            }
        } finally {
            if (elements.ballotLoading) {
                elements.ballotLoading.style.display = 'none';
            }
        }
    };

    const formatVoteTimestamp = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return String(iso);
        }
    };

    const formatScheduleTimestamp = (iso) => {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch (e) {
            return '';
        }
    };

    const showVotingLockedUI = (election, fallbackMessage) => {
        const phase = String(election?.vote_phase || '').toLowerCase();
        const startsAt = formatScheduleTimestamp(election?.start_at);
        const endsAt = formatScheduleTimestamp(election?.end_at);
        const title = phase === 'upcoming' ? 'Voting Has Not Started' : phase === 'closed' ? 'Voting Is Closed' : 'Voting Unavailable';
        const message = fallbackMessage || (
            phase === 'upcoming'
                ? 'Please wait until the official voting time starts.'
                : phase === 'closed'
                    ? 'The voting window for this election has ended.'
                    : 'Voting is not available yet.'
        );
        const scheduleLine = phase === 'upcoming' && startsAt
            ? `Voting starts on ${startsAt}.`
            : phase === 'closed' && endsAt
                ? `Voting ended on ${endsAt}.`
                : '';

        if (elements.straightVoteRoot) elements.straightVoteRoot.style.display = 'none';
        if (elements.ballotRoot) elements.ballotRoot.style.display = 'none';
        if (elements.ballotLoading) elements.ballotLoading.style.display = 'none';
        if (elements.ballotHint) elements.ballotHint.style.display = 'none';

        const selectionCounter = document.getElementById('selectionCounter');
        if (selectionCounter) selectionCounter.style.display = 'none';
        if (elements.reviewBallotBtn) elements.reviewBallotBtn.style.display = 'none';

        if (elements.ballotSubtitle) {
            elements.ballotSubtitle.innerHTML = `<span class="text-warning"><i class="bi bi-clock-fill me-2"></i>${escapeHtml(message)}</span>`;
        }

        const lockedMessage = document.createElement('div');
        lockedMessage.className = 'already-voted-message text-center py-5';
        lockedMessage.innerHTML = `
            <div class="mb-4">
                <div class="voted-icon bg-warning text-dark">
                    <i class="bi bi-clock-history"></i>
                </div>
            </div>
            <h4 class="mb-2">${escapeHtml(title)}</h4>
            <p class="text-muted mb-2">${escapeHtml(message)}</p>
            ${scheduleLine ? `<p class="text-muted small">${escapeHtml(scheduleLine)}</p>` : ''}
            <div class="mt-4">
                <a href="/static/org_elecom/elecom_user/user_dashboard.html" class="btn btn-outline-secondary">
                    <i class="bi bi-house-door me-2"></i>Back to Dashboard
                </a>
            </div>
        `;

        const ballotCard = elements.ballotRoot?.closest('.card');
        if (ballotCard) {
            ballotCard.innerHTML = '';
            ballotCard.appendChild(lockedMessage);
        }
    };

    const showAlreadyVotedUI = (votedAt) => {
        state.hasVoted = true;
        
        // Update progress steps to show all completed
        document.querySelectorAll('.progress-step').forEach(el => {
            el.classList.remove('active');
            el.classList.add('completed');
        });
        document.querySelectorAll('.progress-connector').forEach(el => {
            el.classList.add('active');
        });

        // Hide ballot content
        if (elements.ballotRoot) elements.ballotRoot.style.display = 'none';
        if (elements.ballotLoading) elements.ballotLoading.style.display = 'none';
        if (elements.ballotHint) elements.ballotHint.style.display = 'none';
        
        // Hide selection counter and review button
        const selectionCounter = document.getElementById('selectionCounter');
        if (selectionCounter) selectionCounter.style.display = 'none';
        if (elements.reviewBallotBtn) elements.reviewBallotBtn.style.display = 'none';

        // Update ballot subtitle
        if (elements.ballotSubtitle) {
            elements.ballotSubtitle.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-2"></i>You have successfully voted.</span>';
        }

        // Show already voted message
        const votedMessage = document.createElement('div');
        votedMessage.className = 'already-voted-message text-center py-5';
        votedMessage.innerHTML = `
            <div class="mb-4">
                <div class="voted-icon">
                    <i class="bi bi-check-circle-fill"></i>
                </div>
            </div>
            <h4 class="mb-2">Vote Recorded</h4>
            <p class="text-muted mb-3">You have already cast your vote for this election.</p>
            ${votedAt ? `<p class="text-muted small">Voted on: ${formatVoteTimestamp(votedAt)}</p>` : ''}
            <div class="mt-4">
                <a href="/static/org_elecom/elecom_user/user_receipt.html" class="btn btn-primary me-2">
                    <i class="bi bi-file-text me-2"></i>View Receipt
                </a>
                <a href="/static/org_elecom/elecom_user/user_dashboard.html" class="btn btn-outline-secondary">
                    <i class="bi bi-house-door me-2"></i>Back to Dashboard
                </a>
            </div>
        `;

        // Insert after the selection summary card
        const ballotCard = elements.ballotRoot?.closest('.card');
        if (ballotCard) {
            ballotCard.innerHTML = '';
            ballotCard.appendChild(votedMessage);
        }
    };

    const checkVotingStatus = async () => {
        try {
            const res = await fetch(API_VOTE_STATUS, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            
            if (!res.ok || !data || data.ok !== true) {
                return false;
            }

            if (data.voted) {
                showAlreadyVotedUI(data.voted_at);
                return true;
            }

            const phase = String(data.election?.vote_phase || '').toLowerCase();
            if (phase && phase !== 'active') {
                showVotingLockedUI(data.election);
                return true;
            }
            
            return false;
        } catch (e) {
            console.error('Failed to check voting status:', e);
            return false;
        }
    };

    const init = async () => {
        initModals();

        // Check if already voted first
        const alreadyVoted = await checkVotingStatus();
        if (alreadyVoted) {
            return; // Don't load ballot if already voted
        }

        // Event listeners
        if (elements.reviewBallotBtn) {
            elements.reviewBallotBtn.addEventListener('click', openReviewModal);
        }

        if (elements.confirmBallotBtn) {
            elements.confirmBallotBtn.addEventListener('click', openConfirmModal);
        }

        if (elements.backToReviewBtn) {
            elements.backToReviewBtn.addEventListener('click', goBackToReview);
        }

        if (elements.finalSubmitBtn) {
            elements.finalSubmitBtn.addEventListener('click', submitVote);
        }

        // Close modal handlers to reset progress
        if (elements.reviewModal) {
            elements.reviewModal.addEventListener('hidden.bs.modal', () => {
                updateProgressStep('select');
            });
        }

        // Load ballot
        loadBallot();
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
