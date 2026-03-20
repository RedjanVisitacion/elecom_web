// Election Page - Multi-step Voting Flow: Select → Review → Confirm → Receipt
(function() {
    'use strict';

    const API_BALLOT = '/api/ballot/';
    const API_VOTE_SUBMIT = '/api/vote/submit/';
    const API_VOTE_STATUS = '/api/vote/status/';

    // State
    const state = {
        selections: {},
        ballotData: null,
        candidatesMap: new Map(),
        isSubmitting: false,
        hasVoted: false
    };

    // DOM Elements
    const elements = {
        ballotRoot: document.getElementById('ballotRoot'),
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
        });

        return wrap;
    };

    const renderBallot = (ballot) => {
        if (!elements.ballotRoot) return;
        elements.ballotRoot.innerHTML = '';

        (ballot || []).forEach((orgBlock) => {
            const org = String(orgBlock.organization || '').toUpperCase();
            if (!org) return;

            const orgSection = document.createElement('div');
            orgSection.className = 'org-section';

            const orgHeader = document.createElement('div');
            orgHeader.className = 'org-header';
            orgHeader.innerHTML = `
                <i class="bi bi-building org-icon"></i>
                <span class="org-name">${org}</span>
            `;
            orgSection.appendChild(orgHeader);

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
                    <div class="position-icon">
                        <i class="bi bi-person-badge"></i>
                    </div>
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
                orgSection.appendChild(positionCard);
            });

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
                const org = String(orgBlock.organization || '').toUpperCase();
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
        updateProgressStep('receipt');
        modals.processing?.show();

        try {
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
