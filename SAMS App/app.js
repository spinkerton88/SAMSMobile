// Store data
let storesData = [];
let allStoresData = []; // Keep unfiltered copy for statistics

// DOM elements
const searchBtn = document.getElementById('searchBtn');
const clearBtn = document.getElementById('clearBtn');
const resultsContainer = document.getElementById('resultsContainer');
const resultsCount = document.getElementById('resultsCount');
const loadingDiv = document.getElementById('loading');
const resultsSection = document.getElementById('resultsSection');
const globalSearch = document.getElementById('globalSearch');
const storeModal = document.getElementById('storeModal');
const closeModal = document.getElementById('closeModal');
const modalBody = document.getElementById('modalBody');

// Statistics elements
const totalStores = document.getElementById('totalStores');
const upcomingStores = document.getElementById('upcomingStores');
const totalCountries = document.getElementById('totalCountries');

// Filter inputs
const filters = {
    country: document.getElementById('countryFilter'),
    marketTeam: document.getElementById('marketTeamFilter'),
    market: document.getElementById('marketFilter'),
    storeName: document.getElementById('storeFilter'),
    city: document.getElementById('cityFilter'),
    storeNumber: document.getElementById('storeNumberFilter')
};

// Load data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStoreData();

    // Add event listeners
    searchBtn.addEventListener('click', performSearch);
    clearBtn.addEventListener('click', clearFilters);
    closeModal.addEventListener('click', () => storeModal.style.display = 'none');

    // Close modal on outside click
    storeModal.addEventListener('click', (e) => {
        if (e.target === storeModal) {
            storeModal.style.display = 'none';
        }
    });

    // Global search
    globalSearch.addEventListener('input', debounce(performGlobalSearch, 300));

    // Add enter key support for search inputs
    Object.values(filters).forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    });
});

// Load store data - uses CSV for testing
async function loadStoreData() {
    try {
        loadingDiv.style.display = 'flex';
        resultsSection.style.display = 'none';

        // Load CSV
        console.log('Loading CSV data...');
        const response = await fetch('StoreDirectory_Stores.csv');
        if (!response.ok) {
            throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
        }

        const csvText = await response.text();
        console.log('CSV loaded, parsing...');

        allStoresData = parseCSV(csvText);
        storesData = [...allStoresData];
        console.log(`Parsed ${allStoresData.length} stores from CSV`);

        updateStatistics();
        loadingDiv.style.display = 'none';
        resultsSection.style.display = 'block';
        resultsCount.textContent = `${storesData.length} stores loaded (CSV Data)`;

        // Show all stores on initial load
        displayResults(storesData);
        console.log('Initial display complete');

    } catch (error) {
        console.error('Error loading store data:', error);
        loadingDiv.style.display = 'none';
        resultsSection.style.display = 'block';
        resultsContainer.innerHTML = '<tr><td colspan="8" class="empty-state"><h3>Error loading store data</h3><p>' + error.message + '</p></td></tr>';
    }
}

// Update statistics
function updateStatistics() {
    const openStores = allStoresData.filter(s => getField(s, 'Store Status').toUpperCase() === 'OPEN').length;
    const upcomingCount = allStoresData.filter(s => getField(s, 'Store Status').toUpperCase() === 'UPCOMING').length;
    const countries = new Set(allStoresData.map(s => getField(s, 'Country/Region'))).size;

    totalStores.textContent = openStores;
    upcomingStores.textContent = upcomingCount;
    totalCountries.textContent = countries;
}

// Parse CSV text to array of objects - handles multi-line fields
function parseCSV(text) {
    const lines = [];
    let currentLine = '';
    let inQuotes = false;

    // Split into actual lines (handling quoted newlines)
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentLine += '""';
                i++;
            } else {
                inQuotes = !inQuotes;
                currentLine += char;
            }
        } else if (char === '\n' && !inQuotes) {
            if (currentLine.trim()) {
                lines.push(currentLine);
            }
            currentLine = '';
        } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
            if (currentLine.trim()) {
                lines.push(currentLine);
            }
            currentLine = '';
            i++; // Skip the \n
        } else if (char === '\r' && !inQuotes) {
            if (currentLine.trim()) {
                lines.push(currentLine);
            }
            currentLine = '';
        } else {
            currentLine += char;
        }
    }

    // Add last line
    if (currentLine.trim()) {
        lines.push(currentLine);
    }

    console.log(`Split CSV into ${lines.length} lines`);

    const headers = parseCSVLine(lines[0]);
    console.log(`Found ${headers.length} headers`);
    const stores = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const store = {};
            headers.forEach((header, index) => {
                store[header] = values[index];
            });
            stores.push(store);
        } else {
            console.log(`Skipping line ${i + 1}: expected ${headers.length} fields, got ${values.length}`);
        }
    }

    console.log(`Parsed ${stores.length} valid store records`);
    return stores;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// Helper function to safely get field value
function getField(store, field, defaultValue = '') {
    if (!store) return defaultValue;
    return store[field] || defaultValue;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Global search function
function performGlobalSearch() {
    const searchTerm = globalSearch.value.trim().toLowerCase();

    if (!searchTerm) {
        storesData = [...allStoresData];
        displayResults(storesData);
        return;
    }

    const filtered = allStoresData.filter(store => {
        return (
            getField(store, 'Store Name').toLowerCase().includes(searchTerm) ||
            getField(store, 'Store Number').toLowerCase().includes(searchTerm) ||
            getField(store, 'Physical Address - City').toLowerCase().includes(searchTerm) ||
            getField(store, 'Market').toLowerCase().includes(searchTerm) ||
            getField(store, 'Market Team Name').toLowerCase().includes(searchTerm) ||
            getField(store, 'Country/Region').toLowerCase().includes(searchTerm)
        );
    });

    storesData = filtered;
    displayResults(filtered);
}

// Perform search based on sidebar filters
function performSearch() {
    const filterValues = {
        country: filters.country.value.trim().toLowerCase(),
        marketTeam: filters.marketTeam.value.trim().toLowerCase(),
        market: filters.market.value.trim().toLowerCase(),
        storeName: filters.storeName.value.trim().toLowerCase(),
        city: filters.city.value.trim().toLowerCase(),
        storeNumber: filters.storeNumber.value.trim().toLowerCase()
    };

    console.log('Search filters:', filterValues);

    // Check if any filter is applied
    const hasFilters = Object.values(filterValues).some(val => val !== '');

    if (!hasFilters) {
        console.log('No filters, showing all stores');
        storesData = [...allStoresData];
        displayResults(storesData);
        return;
    }

    // Filter stores
    const filteredStores = allStoresData.filter(store => {
        const storeNum = getField(store, 'Store Number').toLowerCase();
        const storeName = getField(store, 'Store Name').toLowerCase();
        const city = getField(store, 'Physical Address - City').toLowerCase();
        const market = getField(store, 'Market').toLowerCase();
        const marketTeam = getField(store, 'Market Team Name').toLowerCase();
        const country = getField(store, 'Country/Region').toLowerCase();

        // Debug first store to see values
        if (allStoresData.indexOf(store) === 0) {
            console.log('First store values:', {
                storeNum,
                storeName,
                city,
                market,
                marketTeam,
                country
            });
        }

        return (
            (!filterValues.storeNumber || storeNum.includes(filterValues.storeNumber)) &&
            (!filterValues.storeName || storeName.includes(filterValues.storeName)) &&
            (!filterValues.city || city.includes(filterValues.city)) &&
            (!filterValues.market || market.includes(filterValues.market)) &&
            (!filterValues.marketTeam || marketTeam.includes(filterValues.marketTeam)) &&
            (!filterValues.country || country.includes(filterValues.country))
        );
    });

    console.log(`Filtered to ${filteredStores.length} stores`);
    storesData = filteredStores;
    displayResults(filteredStores);
}

// Display search results in table
function displayResults(stores) {
    console.log(`Displaying ${stores.length} stores`);
    resultsCount.textContent = `Found ${stores.length} store${stores.length !== 1 ? 's' : ''}`;

    if (stores.length === 0) {
        resultsContainer.innerHTML = '<tr><td colspan="8" class="empty-state"><h3>No stores found</h3><p>Try adjusting your search criteria.</p></td></tr>';
        return;
    }

    const rows = stores.map(store => createTableRow(store)).join('');
    resultsContainer.innerHTML = rows;
    console.log('Table rows inserted');

    // Add click and touch handlers to store rows for iOS compatibility
    document.querySelectorAll('.store-row').forEach((row, index) => {
        const handleStoreClick = (e) => {
            console.log('Store row clicked/touched:', index);
            showStoreDetail(stores[index]);
        };

        // Add both click and touch events for iOS compatibility
        row.addEventListener('click', handleStoreClick);
        row.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleStoreClick(e);
        });

        // Make row tappable on iOS
        row.style.cursor = 'pointer';
        row.style.webkitTapHighlightColor = 'rgba(0, 0, 0, 0.1)';
    });
    console.log(`Added ${stores.length} click and touch handlers`);
}

// Create table row for a store
function createTableRow(store) {
    const storeNumber = escapeHtml(getField(store, 'Store Number'));
    const storeName = escapeHtml(getField(store, 'Store Name'));
    const country = escapeHtml(getField(store, 'Country/Region'));
    const marketTeam = escapeHtml(getField(store, 'Market Team Name'));
    const market = escapeHtml(getField(store, 'Market'));
    const status = getField(store, 'Store Status', 'Unknown').toUpperCase();
    const statusClass = status === 'OPEN' ? 'open' : 'closed';

    return `
        <tr class="store-row">
            <td class="col-thumbnail">
                <div class="store-thumbnail">🏬</div>
            </td>
            <td class="col-name">
                <a href="#" class="store-name-link" onclick="event.stopPropagation()">${storeName}</a>
            </td>
            <td class="col-number">${storeNumber}</td>
            <td class="col-country">${country}</td>
            <td class="col-market-team">${marketTeam}</td>
            <td class="col-market">${market}</td>
            <td class="col-status">
                <span class="status-badge ${statusClass}">${status}</span>
            </td>
            <td class="col-favorite">
                <span class="favorite-icon" onclick="event.stopPropagation()">♡</span>
            </td>
        </tr>
    `;
}

// Show store detail in modal
function showStoreDetail(store) {
    console.log('showStoreDetail called for store:', getField(store, 'Store Name'));
    const imageUrl = getField(store, 'Secure Image URL') || getField(store, 'Image URL');

    modalBody.innerHTML = `
        <div class="store-detail">
            <div class="store-detail-left">
                ${imageUrl ? `
                <div class="store-image-container">
                    <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(getField(store, 'Store Name'))}" class="store-image">
                </div>
                ` : `
                <div class="store-image-container">
                    <div style="font-size: 60px;">🏬</div>
                </div>
                `}

                <div class="detail-section">
                    <div class="detail-row">
                        <div class="detail-label">Store Name</div>
                        <div class="detail-value"><strong>${escapeHtml(getField(store, 'Store Name'))}</strong></div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Store Number</div>
                        <div class="detail-value"><strong>${escapeHtml(getField(store, 'Store Number'))}</strong></div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Store Information</h3>
                    <div class="detail-row">
                        <div class="detail-label">Store Status</div>
                        <div class="detail-value">
                            <span class="status-badge ${getField(store, 'Store Status').toUpperCase() === 'OPEN' ? 'open' : 'closed'}">
                                ${escapeHtml(getField(store, 'Store Status', 'Unknown').toUpperCase())}
                            </span>
                        </div>
                    </div>
                    ${getField(store, 'Web URL') ? `
                    <div class="detail-row">
                        <div class="detail-label">Web URL</div>
                        <div class="detail-value"><a href="${escapeHtml(getField(store, 'Web URL'))}" target="_blank">${escapeHtml(getField(store, 'Web URL'))}</a></div>
                    </div>
                    ` : ''}
                    ${getField(store, 'Time Zone') ? `
                    <div class="detail-row">
                        <div class="detail-label">Timezone</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Time Zone'))}</div>
                    </div>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <h3>Location Hierarchy</h3>
                    <div class="detail-row">
                        <div class="detail-label">Geo</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Geo'))}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Country/Region</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Country/Region'))}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Company</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Company'))}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Market Team</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Market Team Name'))}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Market</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Market'))}</div>
                    </div>
                </div>

                <div class="detail-section">
                    <h3>Field Support</h3>
                    <div class="detail-row">
                        <div class="detail-label">Market Director</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Market Director'))}</div>
                    </div>
                    ${getField(store, 'Market Director Email') ? `
                    <div class="detail-row">
                        <div class="detail-label">Market Director Email</div>
                        <div class="detail-value"><a href="mailto:${escapeHtml(getField(store, 'Market Director Email'))}">${escapeHtml(getField(store, 'Market Director Email'))}</a></div>
                    </div>
                    ` : ''}
                    <div class="detail-row">
                        <div class="detail-label">Market Leader</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Market Leader'))}</div>
                    </div>
                    ${getField(store, 'Market Leader Email') ? `
                    <div class="detail-row">
                        <div class="detail-label">Market Leader Email</div>
                        <div class="detail-value"><a href="mailto:${escapeHtml(getField(store, 'Market Leader Email'))}">${escapeHtml(getField(store, 'Market Leader Email'))}</a></div>
                    </div>
                    ` : ''}
                    ${getField(store, 'Store Operations Field Leader') ? `
                    <div class="detail-row">
                        <div class="detail-label">Store Operations Field Leader</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Store Operations Field Leader'))}</div>
                    </div>
                    ` : ''}
                    ${getField(store, 'Store Operations Field Leader Email') ? `
                    <div class="detail-row">
                        <div class="detail-label">Store Operations Field Leader Email</div>
                        <div class="detail-value"><a href="mailto:${escapeHtml(getField(store, 'Store Operations Field Leader Email'))}">${escapeHtml(getField(store, 'Store Operations Field Leader Email'))}</a></div>
                    </div>
                    ` : ''}
                    ${getField(store, 'IS&T Field Leader') ? `
                    <div class="detail-row">
                        <div class="detail-label">IS&T Field Leader</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'IS&T Field Leader'))}</div>
                    </div>
                    ` : ''}
                    ${getField(store, 'IS&T Field Leader Email') ? `
                    <div class="detail-row">
                        <div class="detail-label">IS&T Field Leader Email</div>
                        <div class="detail-value"><a href="mailto:${escapeHtml(getField(store, 'IS&T Field Leader Email'))}">${escapeHtml(getField(store, 'IS&T Field Leader Email'))}</a></div>
                    </div>
                    ` : ''}
                    ${getField(store, 'Retail Assistant') ? `
                    <div class="detail-row">
                        <div class="detail-label">Retail Assistant</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Retail Assistant'))}</div>
                    </div>
                    ` : ''}
                    ${getField(store, 'Retail Assistant Email') ? `
                    <div class="detail-row">
                        <div class="detail-label">Retail Assistant Email</div>
                        <div class="detail-value"><a href="mailto:${escapeHtml(getField(store, 'Retail Assistant Email'))}">${escapeHtml(getField(store, 'Retail Assistant Email'))}</a></div>
                    </div>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <h3>Address</h3>
                    <div class="detail-row">
                        <div class="detail-label">Physical Address</div>
                        <div class="detail-value">
                            ${escapeHtml(getField(store, 'Physical Address - Address 1'))}<br>
                            ${getField(store, 'Physical Address - Address 2') ? escapeHtml(getField(store, 'Physical Address - Address 2')) + '<br>' : ''}
                            ${escapeHtml(getField(store, 'Physical Address - City'))},
                            ${escapeHtml(getField(store, 'Physical Address - State/Province'))}
                            ${escapeHtml(getField(store, 'Physical Address - Postal Code'))}<br>
                            ${escapeHtml(getField(store, 'Country/Region'))}
                        </div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Shipping Address</div>
                        <div class="detail-value">
                            ${escapeHtml(getField(store, 'Shipping Address - Address 1'))}<br>
                            ${getField(store, 'Shipping Address - Address 2') ? escapeHtml(getField(store, 'Shipping Address - Address 2')) + '<br>' : ''}
                            ${escapeHtml(getField(store, 'Shipping Address - City'))},
                            ${escapeHtml(getField(store, 'Shipping Address - State/Province'))}
                            ${escapeHtml(getField(store, 'Shipping Address - Postal Code'))}<br>
                            ${escapeHtml(getField(store, 'Country/Region'))}
                        </div>
                    </div>
                </div>

                ${getField(store, 'Store Opening Date') ? `
                <div class="detail-section">
                    <h3>Dates</h3>
                    <div class="detail-row">
                        <div class="detail-label">Opening Date</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Store Opening Date'))}</div>
                    </div>
                    ${getField(store, 'Marketing Date') ? `
                    <div class="detail-row">
                        <div class="detail-label">Marketing Date</div>
                        <div class="detail-value">${escapeHtml(getField(store, 'Marketing Date'))}</div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </div>
    `;

    console.log('Modal HTML content set, now displaying modal...');
    storeModal.style.display = 'flex';
    console.log('Modal display set to flex. Modal should now be visible.');

    // Force a reflow to ensure the modal displays on iOS
    storeModal.offsetHeight;
}

// Clear all filters
function clearFilters() {
    Object.values(filters).forEach(input => {
        input.value = '';
    });
    globalSearch.value = '';
    storesData = [...allStoresData];
    displayResults(storesData);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
