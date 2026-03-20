// Results Page - Display Election Results
(function() {
    'use strict';

    const API_RESULTS = '/api/results/';
    const API_ELECTION_WINDOW = '/api/election/window/';

    // DOM Elements
    const elements = {
        resultsContent: document.getElementById('resultsContent'),
        lockedContent: document.getElementById('lockedContent'),
        resultsContainer: document.getElementById('resultsContainer'),
        summaryDashboard: document.getElementById('summaryDashboard'),
        totalVoters: document.getElementById('totalVoters'),
        totalVotes: document.getElementById('totalVotes'),
        turnoutRate: document.getElementById('turnoutRate'),
        totalPositions: document.getElementById('totalPositions'),
        resultDateInfo: document.getElementById('resultDateInfo'),
        resultDateText: document.getElementById('resultDateText'),
        countdownContainer: document.getElementById('countdownContainer'),
        cdDays: document.getElementById('cd_days'),
        cdHours: document.getElementById('cd_hours'),
        cdMins: document.getElementById('cd_mins'),
        cdSecs: document.getElementById('cd_secs')
    };

    let countdownInterval = null;

    const formatDateTime = (iso) => {
        if (!iso) return null;
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            return d.toLocaleString(undefined, {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return null;
        }
    };

    const checkResultsAvailability = async () => {
        try {
            const res = await fetch(API_ELECTION_WINDOW, { method: 'GET', cache: 'no-store' });
            const data = await res.json();

            if (!res.ok || !data || !data.ok || !data.election) {
                showLockedState();
                return;
            }

            const election = data.election;
            const resultsAt = election.results_at ? new Date(election.results_at) : null;
            const now = new Date();

            // Check if results should be available
            if (!resultsAt) {
                showLockedState(null);
                return;
            }

            if (now >= resultsAt) {
                // Results are available
                showResultsState();
                await loadResults();
            } else {
                // Results not yet available, show countdown
                showLockedState(resultsAt);
                startCountdown(resultsAt);
            }
        } catch (e) {
            console.error('Failed to check results availability:', e);
            showLockedState();
        }
    };

    const showLockedState = (resultsAt) => {
        if (elements.lockedContent) {
            elements.lockedContent.style.display = '';
        }
        if (elements.resultsContent) {
            elements.resultsContent.style.display = 'none';
        }

        if (resultsAt && elements.resultDateInfo && elements.resultDateText) {
            elements.resultDateInfo.style.display = '';
            elements.resultDateText.textContent = `Results will be available on: ${formatDateTime(resultsAt.toISOString())}`;
        } else if (elements.resultDateInfo) {
            elements.resultDateInfo.style.display = 'none';
        }

        if (resultsAt && elements.countdownContainer) {
            elements.countdownContainer.style.display = 'flex';
        } else if (elements.countdownContainer) {
            elements.countdownContainer.style.display = 'none';
        }
    };

    const showResultsState = () => {
        if (elements.lockedContent) {
            elements.lockedContent.style.display = 'none';
        }
        if (elements.resultsContent) {
            elements.resultsContent.style.display = '';
        }

        // Stop countdown if running
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    };

    const startCountdown = (targetDate) => {
        const updateCountdown = () => {
            const now = new Date();
            const diff = targetDate - now;

            if (diff <= 0) {
                // Time's up, reload to show results
                showResultsState();
                loadResults();
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            if (elements.cdDays) elements.cdDays.textContent = String(days).padStart(2, '0');
            if (elements.cdHours) elements.cdHours.textContent = String(hours).padStart(2, '0');
            if (elements.cdMins) elements.cdMins.textContent = String(mins).padStart(2, '0');
            if (elements.cdSecs) elements.cdSecs.textContent = String(secs).padStart(2, '0');
        };

        // Initial update
        updateCountdown();

        // Start interval
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        countdownInterval = setInterval(updateCountdown, 1000);
    };

    const loadResults = async () => {
        try {
            const res = await fetch(API_RESULTS, { method: 'GET', cache: 'no-store' });
            const data = await res.json();

            if (!res.ok || !data || !data.ok) {
                showError('Failed to load results.');
                return;
            }

            // Check if results are published
            if (!data.published) {
                // Keep showing countdown - results not yet available
                return;
            }

            // Show results content
            if (elements.lockedContent) {
                elements.lockedContent.style.display = 'none';
            }
            if (elements.resultsContent) {
                elements.resultsContent.style.display = 'block';
            }

            // Render summary dashboard
            renderSummaryDashboard(data);

            // Render results
            renderResults(data.grouped || []);
        } catch (e) {
            console.error('Failed to load results:', e);
            showError('Failed to load results. Please try again later.');
        }
    };

    const renderSummaryDashboard = (data) => {
        if (!elements.summaryDashboard) return;

        // Calculate statistics
        let totalVotes = 0;
        let totalCandidates = 0;
        let positionCount = 0;

        if (data.grouped) {
            data.grouped.forEach(party => {
                if (party.organizations) {
                    party.organizations.forEach(org => {
                        if (org.positions) {
                            org.positions.forEach(pos => {
                                positionCount++;
                                if (pos.candidates) {
                                    pos.candidates.forEach(c => {
                                        totalVotes += c.votes || 0;
                                        totalCandidates++;
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }

        // Get total voters from org_totals
        let totalVoters = 0;
        if (data.org_totals) {
            totalVoters = Object.values(data.org_totals).reduce((sum, v) => sum + v, 0);
        }

        // Calculate turnout rate
        const turnoutRate = totalVoters > 0 ? Math.round((totalVotes / totalVoters) * 100) : 0;

        // Animate numbers
        animateNumber(elements.totalVoters, totalVoters || totalVotes);
        animateNumber(elements.totalVotes, totalVotes);
        animateNumber(elements.totalPositions, positionCount);
        
        if (elements.turnoutRate) {
            elements.turnoutRate.textContent = turnoutRate + '%';
        }

        // Show dashboard with animation
        elements.summaryDashboard.style.display = 'block';
        elements.summaryDashboard.style.animation = 'fadeInUp 0.6s ease-out';
    };

    const animateNumber = (element, targetValue) => {
        if (!element) return;
        
        const duration = 1000;
        const startValue = 0;
        const startTime = performance.now();

        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);
            
            element.textContent = currentValue.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            }
        };

        requestAnimationFrame(updateNumber);
    };

    const showError = (message) => {
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>${message}
                </div>
            `;
        }
    };

    const getPositionPriority = (position) => {
        const priorities = [
            'PRESIDENT',
            'VICE PRESIDENT',
            'GENERAL SECRETARY',
            'ASSOCIATE SECRETARY',
            'TREASURER',
            'AUDITOR',
            'PUBLIC INFORMATION OFFICER',
            'P.I.O',
            'PIO',
        ];
        
        const up = (position || '').toUpperCase().trim();
        const normalized = up.replace('P.I.O', 'PIO').replace('P. I. O', 'PIO');
        
        if (normalized.includes('REPRESENTATIVE')) {
            return 1000;
        }
        
        for (let i = 0; i < priorities.length; i++) {
            if (normalized === priorities[i] || normalized === priorities[i].replace('P.I.O', 'PIO')) {
                return i;
            }
        }
        
        return 500;
    };

    const getOrgPriority = (org) => {
        const up = (org || '').toUpperCase().trim();
        if (up === 'USG' || up.includes('USG')) return 0;
        if (up === 'SITE' || up.includes('SITE')) return 1;
        if (up === 'PAFE' || up.includes('PAFE')) return 2;
        if (up === 'AFPROTECHS' || up.includes('AFPROTECHS')) return 3;
        return 999;
    };

    const renderResults = (grouped) => {
        if (!elements.resultsContainer) return;

        if (!grouped || grouped.length === 0) {
            elements.resultsContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>No results available yet.
                </div>
            `;
            return;
        }

        // Group by organization first, then position
        const orgsMap = new Map();

        grouped.forEach(party => {
            const partyName = party.party_name || 'Independent';
            
            party.organizations?.forEach(org => {
                const orgName = org.organization;
                
                if (!orgsMap.has(orgName)) {
                    orgsMap.set(orgName, {
                        name: orgName,
                        positions: new Map(),
                        priority: getOrgPriority(orgName)
                    });
                }
                
                const orgData = orgsMap.get(orgName);
                
                org.positions?.forEach(pos => {
                    const positionName = pos.position;
                    
                    if (!orgData.positions.has(positionName)) {
                        orgData.positions.set(positionName, {
                            name: positionName,
                            candidates: [],
                            priority: getPositionPriority(positionName)
                        });
                    }
                    
                    const posData = orgData.positions.get(positionName);
                    
                    pos.candidates?.forEach(c => {
                        posData.candidates.push({
                            ...c,
                            partyName
                        });
                    });
                });
            });
        });

        // Sort organizations by priority
        const orgs = Array.from(orgsMap.values())
            .sort((a, b) => a.priority - b.priority);

        let html = '';
        let orgIndex = 0;

        orgs.forEach(org => {
            const positions = Array.from(org.positions.values())
                .sort((a, b) => a.priority - b.priority);

            if (positions.length === 0) return;

            html += `<div class="org-section" style="animation-delay: ${orgIndex * 0.1}s">`;
            html += `<div class="org-header">${org.name}</div>`;

            positions.forEach((pos, posIndex) => {
                if (pos.candidates.length === 0) return;

                // Sort candidates by votes descending
                pos.candidates.sort((a, b) => (b.votes || 0) - (a.votes || 0));
                
                const totalPositionVotes = pos.candidates.reduce((sum, c) => sum + (c.votes || 0), 0);
                const maxVotes = Math.max(...pos.candidates.map(c => c.votes || 0));

                html += `<div class="position-section" style="animation-delay: ${(orgIndex + posIndex) * 0.05}s">`;
                html += `<div class="position-subheader"><i class="bi bi-briefcase"></i>${pos.name}</div>`;

                html += `<div class="candidates-list">`;

                // Check if this is a representative position
                const isRepresentativePosition = pos.name.toUpperCase().includes('REPRESENTATIVE');

                pos.candidates.forEach((c, index) => {
                    const rank = index + 1;
                    const isWinner = (c.votes || 0) === maxVotes && maxVotes > 0;
                    
                    // For representative positions, each elected candidate shows 100%
                    // For competitive positions (President, VP, etc.), calculate percentage normally
                    let percentageOfTotal;
                    if (isRepresentativePosition) {
                        // Representatives: show 100% if they have any votes (elected)
                        percentageOfTotal = (c.votes || 0) > 0 ? 100.0 : 0.0;
                    } else {
                        // Competitive positions: calculate as share of total votes
                        percentageOfTotal = totalPositionVotes > 0 
                            ? ((c.votes || 0) / totalPositionVotes * 100).toFixed(1) 
                            : 0;
                    }
                    
                    const barWidth = maxVotes > 0 ? ((c.votes || 0) / maxVotes * 100) : 0;

                    // Rank class
                    let rankClass = 'rank-other';
                    if (rank === 1) rankClass = 'rank-1';
                    else if (rank === 2) rankClass = 'rank-2';
                    else if (rank === 3) rankClass = 'rank-3';

                    html += `
                        <div class="candidate-row ${isWinner ? 'winner' : ''}" style="animation: fadeInUp 0.5s ease-out ${index * 0.08}s both;">
                            <div class="rank-badge ${rankClass}">${rank}</div>
                            <div class="candidate-avatar">
                                ${c.photo_url 
                                    ? `<img src="${c.photo_url}" alt="">`
                                    : '<i class="bi bi-person-circle"></i>'
                                }
                            </div>
                            <div class="candidate-details">
                                <div class="candidate-name-row">
                                    <span class="name">${c.name || 'Unknown'}</span>
                                    ${isWinner ? '<span class="winner-tag"><i class="bi bi-trophy-fill"></i>Winner</span>' : ''}
                                </div>
                                <div class="candidate-meta">
                                    <span class="party">${c.partyName}</span>
                                </div>
                                <div class="progress-wrapper">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: 0%;" data-width="${barWidth}%"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="vote-info">
                                <div class="vote-count">${(c.votes || 0).toLocaleString()}</div>
                                <div class="vote-percent">${percentageOfTotal}%</div>
                            </div>
                        </div>
                    `;
                });

                html += `</div></div>`;
            });

            html += `</div>`;
            orgIndex++;
        });

        elements.resultsContainer.innerHTML = html;

        // Animate progress bars after rendering
        setTimeout(() => {
            const progressBars = document.querySelectorAll('.progress-fill');
            progressBars.forEach(bar => {
                const targetWidth = bar.getAttribute('data-width');
                if (targetWidth) {
                    bar.style.width = targetWidth;
                }
            });
        }, 100);
    };

    const init = async () => {
        await checkResultsAvailability();
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
    });
})();
