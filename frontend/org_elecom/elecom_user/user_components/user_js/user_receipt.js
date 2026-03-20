// Receipt Page - Display Voting Receipt
(function() {
    'use strict';

    const API_RECEIPT = '/api/vote/receipt/';

    // DOM Elements
    const elements = {
        referenceNumber: document.getElementById('referenceNumber'),
        voteDateTime: document.getElementById('voteDateTime'),
        totalSelections: document.getElementById('totalSelections'),
        receiptContent: document.getElementById('receiptContent'),
        printReceiptBtn: document.getElementById('printReceiptBtn'),
        saveReceiptBtn: document.getElementById('saveReceiptBtn'),
        shareReceiptBtn: document.getElementById('shareReceiptBtn'),
        viewResultsBtn: document.getElementById('viewResultsBtn'),
        // Section containers
        progressSteps: document.getElementById('progressSteps'),
        successBanner: document.getElementById('successBanner'),
        noVoteBanner: document.getElementById('noVoteBanner'),
        receiptCard: document.getElementById('receiptCard'),
        actionsCard: document.getElementById('actionsCard'),
        goVoteCard: document.getElementById('goVoteCard')
    };

    const showSection = (el) => {
        if (el) el.style.display = '';
    };

    const hideSection = (el) => {
        if (el) el.style.display = 'none !important';
    };

    const formatDateTime = (iso) => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (e) {
            return String(iso);
        }
    };

    const loadReceiptData = async () => {
        // Try to load from API first
        try {
            const res = await fetch(API_RECEIPT, { method: 'GET', cache: 'no-store' });
            const data = await res.json();
            
            if (res.ok && data && data.ok === true && data.receipt) {
                // Transform API response to match expected format
                const receiptData = {
                    referenceNumber: data.receipt.reference_number,
                    votedAt: data.receipt.voted_at,
                    totalSelections: data.receipt.total_selections,
                    selections: data.receipt.selections,
                    candidates: data.receipt.candidates,
                    ballotData: data.receipt.ballot_data
                };
                renderReceipt(receiptData);
                return;
            }
            
            // If API returns 404 or no receipt, show no vote state
            if (res.status === 404 || (data && data.ok === false)) {
                showNoVoteState();
                return;
            }
        } catch (e) {
            console.log('API fetch failed, falling back to sessionStorage');
        }
        
        // Fall back to sessionStorage
        try {
            const stored = sessionStorage.getItem('elecom_vote_receipt');
            if (!stored) {
                showNoVoteState();
                return;
            }

            const data = JSON.parse(stored);
            renderReceipt(data);
        } catch (e) {
            showNoVoteState();
        }
    };

    const showNoVoteState = () => {
        // Hide receipt sections
        hideSection(elements.progressSteps);
        hideSection(elements.successBanner);
        hideSection(elements.receiptCard);
        hideSection(elements.actionsCard);
        
        // Show no vote sections
        showSection(elements.noVoteBanner);
        showSection(elements.goVoteCard);
        
        // Clear receipt content
        if (elements.receiptContent) {
            elements.receiptContent.innerHTML = '';
        }
        if (elements.referenceNumber) elements.referenceNumber.textContent = '—';
        if (elements.voteDateTime) elements.voteDateTime.textContent = '—';
        if (elements.totalSelections) elements.totalSelections.textContent = '—';
    };

    const showVotedState = () => {
        // Show receipt sections
        showSection(elements.progressSteps);
        showSection(elements.successBanner);
        showSection(elements.receiptCard);
        showSection(elements.actionsCard);
        
        // Hide no vote sections
        hideSection(elements.noVoteBanner);
        hideSection(elements.goVoteCard);
    };

    const showNoReceiptMessage = () => {
        showNoVoteState();
    };

    const getCandidateInfo = (id, candidatesMap) => {
        return candidatesMap?.[String(id)] || { id, name: 'Unknown Candidate', party_name: '', photo_url: null };
    };

    const renderReceipt = (data) => {
        // First show the voted state sections
        showVotedState();
        
        // Set header info
        if (elements.referenceNumber) {
            elements.referenceNumber.textContent = data.referenceNumber || '—';
        }
        if (elements.voteDateTime) {
            elements.voteDateTime.textContent = formatDateTime(data.votedAt);
        }
        if (elements.totalSelections) {
            const count = data.totalSelections || 0;
            elements.totalSelections.textContent = `${count} candidate${count !== 1 ? 's' : ''}`;
        }

        // Build receipt content
        const { selections, candidates, ballotData } = data;

        if (!ballotData || !ballotData.ballot) {
            elements.receiptContent.innerHTML = '<p class="text-muted">No ballot data available.</p>';
            return;
        }

        let receiptHTML = '';

        ballotData.ballot.forEach((orgBlock) => {
            const org = String(orgBlock.organization || '').toUpperCase();
            if (!org) return;

            let hasSelections = false;
            let orgContent = '';

            (orgBlock.positions || []).forEach((posBlock) => {
                const pos = String(posBlock.position || '');
                const positionKey = `${org}::${pos}`;
                const selectedIds = selections?.[positionKey];

                if (!selectedIds || (Array.isArray(selectedIds) && selectedIds.length === 0)) return;

                hasSelections = true;
                const ids = Array.isArray(selectedIds) ? selectedIds : [selectedIds];

                let candidatesHTML = '';
                ids.forEach(id => {
                    const candidate = getCandidateInfo(id, candidates);
                    candidatesHTML += `
                        <div class="receipt-candidate">
                            <div class="receipt-candidate-avatar">
                                ${candidate.photo_url 
                                    ? `<img src="${candidate.photo_url}" alt="">`
                                    : '<i class="bi bi-person-circle"></i>'
                                }
                            </div>
                            <div class="receipt-candidate-info">
                                <div class="receipt-candidate-name">${candidate.name}</div>
                                ${candidate.party_name ? `<div class="receipt-candidate-party">${candidate.party_name}</div>` : ''}
                            </div>
                            <i class="bi bi-check-circle-fill receipt-check-icon"></i>
                        </div>
                    `;
                });

                orgContent += `
                    <div class="receipt-position">
                        <div class="receipt-position-title">${pos}</div>
                        ${candidatesHTML}
                    </div>
                `;
            });

            if (hasSelections) {
                receiptHTML += `
                    <div class="receipt-org-section">
                        <div class="receipt-org-header">${org}</div>
                        ${orgContent}
                    </div>
                `;
            }
        });

        if (elements.receiptContent) {
            elements.receiptContent.innerHTML = receiptHTML || '<p class="text-muted">No selections recorded.</p>';
        }
    };

    const printReceipt = () => {
        window.print();
    };

    const saveReceiptAsImage = async () => {
        alert('Receipt saved! (In production, this would generate an image of the receipt)');
    };

    const shareReceipt = async () => {
        const ref = elements.referenceNumber?.textContent || '—';
        const shareText = `I just voted in the ELECOM Election! Reference: ${ref}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Voting Receipt - ELECOM',
                    text: shareText
                });
            } catch (e) {
                // User cancelled or error
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareText);
                alert('Receipt reference copied to clipboard!');
            } catch (e) {
                alert('Share text: ' + shareText);
            }
        }
    };

    const init = async () => {
        // Load receipt data from API
        await loadReceiptData();

        // Event listeners
        if (elements.printReceiptBtn) {
            elements.printReceiptBtn.addEventListener('click', printReceipt);
        }

        if (elements.saveReceiptBtn) {
            elements.saveReceiptBtn.addEventListener('click', saveReceiptAsImage);
        }

        if (elements.shareReceiptBtn) {
            elements.shareReceiptBtn.addEventListener('click', shareReceipt);
        }

        if (elements.viewResultsBtn) {
            elements.viewResultsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Results will be available after the election closes.');
            });
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
