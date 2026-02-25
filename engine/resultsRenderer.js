// Results Renderer Module
import { appState, selectedFilters } from "../state/appState.js";

import {
  normalizeText,
  getFullDescription,
  getGenderFromLeafAndParent,
  findParentWithRate,
  getRateLabel,
  escapeRegExp,
  getHierarchyPath
} from "./htsEngine.js";

import { ICON_PLUS, ICON_MINUS } from "../constants/icons.js";
import { GENDER_TERMS } from "../constants/genderRules.js";


let COUNTRY_ENGINE = null;

export function initResultsRenderer(engine) {
  COUNTRY_ENGINE = engine;
}

export function getDirectChildren(parentItem) {
        const parentIndex = appState.masterData.indexOf(parentItem);
        const parentIndent = parseInt(parentItem.indent);
        const children = [];

        for (let i = parentIndex + 1; i < appState.masterData.length; i++) {
            const current = appState.masterData[i];
            const indent = parseInt(current.indent);

            if (indent <= parentIndent) break;   // stop at sibling/ancestor
            if (indent === parentIndent + 1) {
                children.push(current);
            }
        }
        return children;
    }

    export function highlightText(
        text,
        searchWords = [],
        genderWords = [],
        fabricWords = [],
        featureWords = []
        ) {
        if (!appState.highlightEnabled) {
            return text;
        }
    
        let highlighted = text;
    
        // helper: match whole words, allow plurals, ignore substrings
        const wordRegex = (word) =>
            new RegExp(
                `(?<![a-zA-Z-])(${escapeRegExp(word)})(s)?(?![a-zA-Z-])`,
                'gi'
            );
    
        // 🔍 Search keywords
        searchWords.forEach(word => {
            highlighted = highlighted.replace(
                wordRegex(word),
                '<span class="highlight-search">$1$2</span>'
            );
        });
    
        // 🚻 Gender
        genderWords.forEach(word => {
            const regex = new RegExp(
                `\\b(${escapeRegExp(word)})(['’]s)?\\b`,
                'gi'
            );
            highlighted = highlighted.replace(
                regex,
                '<span class="highlight-gender">$&</span>'
            );
        });
    
        // 🧵 Fabric
        fabricWords.forEach(word => {
            highlighted = highlighted.replace(
                wordRegex(word),
                '<span class="highlight-fabric">$1$2</span>'
            );
        });
    
        // ⭐ Feature
        featureWords.forEach(word => {
            highlighted = highlighted.replace(
                wordRegex(word),
                '<span class="highlight-feature">$1$2</span>'
            );
        });
    
        return highlighted;
    }

    export function highlightInheritedParts(fullDescription, itemDescription, searchWords,genderTerms = [],fabricTerms = [],featureTerms = []) {
    
        if (!appState.highlightEnabled) {
            return fullDescription;
        }
        const parts = fullDescription.split(' > ');
        let highlightedParts = [];

        const itemDescIndex = parts.findIndex(part =>
            part.trim().toLowerCase() === itemDescription.trim().toLowerCase()
        );

        parts.forEach((part, index) => {
            let highlightedPart = part;

            // Pass genderTerms along with searchWords
            highlightedPart = highlightText(
                highlightedPart,
                searchWords,
                genderTerms,
                fabricTerms,
                featureTerms
            );

            if (index < itemDescIndex && itemDescIndex !== -1) {
                if (!highlightedPart.includes('highlight-search')) {
                    highlightedPart = `<span class="highlight-inherited">${highlightedPart}</span>`;
                } else {
                    highlightedPart = highlightedPart.replace(
                        /([^>]+?)(?=<span class="highlight-search">|$)/g,
                        (match) => match.trim() ? `<span class="highlight-inherited">${match}</span>` : match
                    );
                }
            }
            highlightedParts.push(highlightedPart);
        });

        return highlightedParts.join(' > ');
    }

      export function renderHTSHierarchy(htsCode) {
                                    const leaf = appState.masterData.find(e => e.htsno === htsCode);
                                    if (!leaf) return;
    
                                    const path = getHierarchyPath(leaf); // array of nodes from root → leaf
                                    const container = document.getElementById("htsHierarchyContainer");
                                    container.innerHTML = "";
    
                                    path.forEach((node, idx) => {
                                        const hasChildren = getDirectChildren(node).length > 0;
    
                                        const div = document.createElement("div");
                                        div.className = `hts-node indent-${idx}`;
    
                                        // check if this node is in the path to the final HTS
                                        const isLeaf = idx === path.length - 1;
    
                                        div.innerHTML = `
                                            ${hasChildren
                                                ? `<span class="hts-toggle" title="Expand / Collapse">${ICON_PLUS}</span>`
                                                : `<span class="hts-spacer"></span>`}
                                            <span class="hts-code" style="font-weight:${isLeaf ? 'bold' : 'normal'}; color:${isLeaf ? '#4d6dfd' : '#333'}">
                                                ${node.htsno || ""}
                                            </span>
                                            <span class="hts-desc"
                                                style="
                                                    font-weight: ${isLeaf ? 'bold' : 'normal'};
                                                    color: ${isLeaf ? '#4d6dfd' : '#333'};
                                                "
                                                >
                                                ${node.description}
                                            </span>
                                        `;
    
                                        if (hasChildren) {
                                            const childContainer = document.createElement("div");
                                            childContainer.className = "hts-children";
                                            childContainer.style.display = "none";
                                            div.appendChild(childContainer);
    
                                            const toggle = div.querySelector(".hts-toggle");
                                            toggle.addEventListener("click", (e) => {
                                                e.stopPropagation();
    
                                                const isOpen = childContainer.style.display === "block";
                                                childContainer.style.display = isOpen ? "none" : "block";
                                                toggle.innerHTML = isOpen ? ICON_PLUS : ICON_MINUS;
    
                                                if (!isOpen && childContainer.dataset.loaded !== "true") {
                                                    childContainer.dataset.loaded = "true";
    
                                                    const children = getDirectChildren(node);
                                                    children.forEach(c => {
                                                        const childDiv = document.createElement("div");
                                                        childDiv.className = `hts-node indent-${idx + 1}`;
    
                                                        const isChildLeaf = c.htsno === htsCode; // final leaf?
    
                                                        childDiv.innerHTML = `
                                                            <div class="hts-row">
                                                                <span class="hts-spacer"></span>
                                                                <span class="hts-code" style="font-weight:${isChildLeaf ? 'normal' : 'normal'}">
                                                                    ${c.htsno || ""}
                                                                </span>
                                                                <span class="hts-desc" ${isChildLeaf ? '' : ''}>
                                                                    ${c.description}
                                                                </span>
                                                            </div>
                                                        `;
                                                        childContainer.appendChild(childDiv);
                                                    });
                                                }
                                            });
                                        }
    
                                        container.appendChild(div);
                                    });
                                }

                                export function showDetails(item, exportingCountry) {
                                    const modal = document.getElementById('detailModal');
                                    const modalBody = document.getElementById('modalBody');
                                    const htsCode = item.htsno;
            
                                    const rateInfo = COUNTRY_ENGINE.getDutyRate(
                                        item,
                                        exportingCountry,
                                        findParentWithRate
                                    );
                                    
                                    let rate = rateInfo.value;
                                    let rateType = getRateLabel(rateInfo.column);
                                    let isInherited = rateInfo.inherited;
                                    let inheritedFrom = null;
            
                                    let breakdownHTML = '<div>';
                                   
            
                                    // Build hierarchy items
                                    const hierarchyItems = [];
                                    let currentIndent = parseInt(item.indent);
                                    let currentIndex = appState.masterData.indexOf(item);
            
                                    for (let i = currentIndex; i >= 0; i--) {
                                        const checkItem = appState.masterData[i];
                                        const checkIndent = parseInt(checkItem.indent);
            
                                        // Only add if this item has a smaller indent than the previous
                                        if (checkIndent < currentIndent) {
                                            hierarchyItems.unshift(checkItem);
                                            currentIndent = checkIndent;
                                        }
            
                                        // Always include the current item itself once
                                        if (i === currentIndex && !hierarchyItems.includes(checkItem)) {
                                            hierarchyItems.unshift(checkItem);
                                        }
            
                                        if (currentIndent === 0) break;
                                    }
            
                                    hierarchyItems.forEach(hierarchyItem => {
                                        const indent = parseInt(hierarchyItem.indent);
                                        const indentClass = `indent-${indent}`;
                                        const isRateSource = inheritedFrom && hierarchyItem.htsno === inheritedFrom.htsno;
            
                                        breakdownHTML += `<div class="hts-breakdown-item ${indentClass} ${isRateSource ? 'highlight-inherited' : ''}">
                                            ${hierarchyItem.htsno ? `<strong>${hierarchyItem.htsno}:</strong> ` : ''}
                                            ${hierarchyItem.description}
                                            ${isRateSource ? ` <span class="rate-inherited">(Rate inherited from here)</span>` : ''}
                                        </div>`;
                                    });
            
                                    breakdownHTML += '</div>';
            
                                    // Add the expandable hierarchy container **before inserting into modal**
                                    breakdownHTML += `
                                        <div id="htsHierarchyContainer" style="margin-top:10px;">
                                            <!-- Expandable hierarchy will be rendered here -->
                                        </div>
                                    `;
            
                                    const rateHTML = `
                                                                <div class="rate-info">
                                                                    <div><strong>Rate Type:</strong> ${rateType}</div>
                                                                    <div><strong>Rate:</strong> ${rate} ${isInherited ? '<span class="rate-inherited">(inherited from parent)</span>' : ''}</div>
                                                                    <div><strong>Additional Duty:</strong> ${rateInfo.additionalDuty ?? '—'}</div>
                                                                    <div><strong>Reciprocal Tariff:</strong> ${rateInfo.reciprocalTariff ?? '—'}</div>
                                                                    <div><strong>Total Duty Rate:</strong> ${rateInfo.totalDuty ?? '—'}</div>
                                                                    ${item.units && item.units.length > 0 ? `<div><strong>Units:</strong> ${item.units.join(', ')}</div>` : ''}
                                                                </div>
                                                            `;
            
                                    // Insert everything into modalBody **once**
                                    modalBody.innerHTML = breakdownHTML + rateHTML;
            
                                    // Render expandable hierarchy inside the container
                                    renderHTSHierarchy(htsCode);
            
                                    modal.style.display = 'block';
                                }

                             export function displayResults(primaryResults, secondaryResults, exportingCountry, searchWords){
                                                        const container = document.getElementById('resultsContainer');
                                                        const totalResults = primaryResults.length + secondaryResults.length;
                                                        
                                
                                                        if (totalResults === 0) {
                                                            container.innerHTML = '<div class="no-results">No results found for the selected filters</div>';
                                                            return;
                                                        }
                                
                                                        let html = '<div class="results-header">';
                                                        html += `<div class="count-breakdown">`;
                                                        html += `<div class="count-item">Total Results: ${totalResults}</div>`;
                                                        html += `<div class="count-item primary">Match Results: ${primaryResults.length}</div>`;
                                                        html += `<div class="count-item secondary">Related Results: ${secondaryResults.length}</div>`;
                                                        html += `</div>`;
                                                        html += '</div>';
                                
                                                        // Gender terms to highlight
                                                        // Correct gender terms from GENDER_TERMS
                                                        const genderTerms =
                                                            selectedFilters.gender && selectedFilters.gender !== 'All'
                                                            ? GENDER_TERMS[selectedFilters.gender]
                                                            : [];
                                                        
                                                        const fabricTerms =
                                                            selectedFilters.fabric && selectedFilters.fabric !== 'All'
                                                                ? [normalizeText(selectedFilters.fabric)]
                                                                : [];
                                                        const featureTerms =
                                                            selectedFilters.feature && selectedFilters.feature !== 'All'
                                                                ? [normalizeText(selectedFilters.feature)]
                                                                : [];

                                                        // Decide whether to show Reciprocal Tariff column for this exporting country.
                                                        const parseNum = (v) => {
                                                            if (v === null || v === undefined) return NaN;
                                                            if (typeof v === 'number') return v;
                                                            const m = String(v).match(/-?\d+(?:\.\d+)?/);
                                                            return m ? parseFloat(m[0]) : NaN;
                                                        };

                                                        let showReciprocal = false;
                                                        const dataToScan = (appState && Array.isArray(appState.masterData) && appState.masterData.length > 0)
                                                            ? appState.masterData
                                                            : [...primaryResults, ...secondaryResults];

                                                        for (const it of dataToScan) {
                                                            const ri = COUNTRY_ENGINE.getDutyRate(it, exportingCountry, findParentWithRate);
                                                            const recNum = parseNum(ri?.reciprocalTariff);
                                                            if (Number.isFinite(recNum) && recNum !== 0) {
                                                                showReciprocal = true;
                                                                break;
                                                            }
                                                        }

                                                        if (primaryResults.length > 0) {
                                                            html += `
                                                                <div class="table-wrap">
                                                                <table class="results-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>#</th>
                                                                            <th>HTS Code</th>
                                                                            <th>Description</th>
                                                                            <th>Rate Type</th>
                                                                            <th>Rate of Duty</th>
                                                                            <th>Additional Duty</th>
                                                                            ${showReciprocal ? '<th>Reciprocal Tariff</th>' : ''}
                                                                            <th>Total Duty Rate</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                            `;
                                
                                                            primaryResults.forEach((item, index) => {
                                                                const fullDescription = getFullDescription(item);
                                
                                                                const highlightedDescription = highlightInheritedParts(
                                                                    fullDescription,
                                                                    item.description,
                                                                    searchWords,
                                                                    genderTerms,
                                                                    fabricTerms,
                                                                    featureTerms
                                                                );
                                
                                
                                                                const rateInfo = COUNTRY_ENGINE.getDutyRate(
                                                                    item,
                                                                    exportingCountry,
                                                                    findParentWithRate
                                                                );
                                                                
                                
                                                                const leafGenders = getGenderFromLeafAndParent(item);
                                
                                                                // 1️⃣ Normalize description for gender detection
                                                                const normalizedDesc = fullDescription
                                                                    .replace(/\(\d+\)/g, '')   // remove numeric codes like (359)
                                                                    .replace(/>/g, '')         // remove > symbols
                                                                    .replace(/[':]/g, '')      // remove quotes and colons
                                                                    .toLowerCase();            // lowercase for easier matching
                                
                                                                // 2️⃣ Detect if description already contains any gender
                                                                const genders = ['men','women','boys','girls'];
                                                                const descriptionHasGender = genders.some(g => normalizedDesc.includes(g));
                                
                                                                // 3️⃣ Only add badge if description doesn't already include that gender
                                                                const uniqueGenders = leafGenders?.filter(g => !normalizedDesc.includes(g.toLowerCase()));
                                                                const genderBadge = !descriptionHasGender && uniqueGenders && uniqueGenders.length
                                                                    ? `<span class="gender-badge">${uniqueGenders.join(" / ")}</span>`
                                                                    : '';
                                
                                                                html += `
                                                                    <tr
                                                                        class="hts-row"
                                                                        data-description="${normalizeText(fullDescription)}"
                                                                        onclick='showDetails(${JSON.stringify(item).replace(/'/g, "&apos;")}, "${exportingCountry}")'
                                                                    >
                                                                        <td class="row-number">${index + 1}</td>
                                                                        <td>
                                                                            <div class="hts-code-wrapper">
                                                                                <a
                                                                                    href="https://hts.usitc.gov/search?query=${encodeURIComponent(item.htsno)}"
                                                                                    target="_blank"
                                                                                    class="hts-code-link"
                                                                                    title="View HTS Code Structure on USITC Website"
                                                                                    onclick="event.stopPropagation()"
                                                                                >
                                                                                    ${item.htsno}
                                                                                </a>
                                
                                                                                <button
                                                                                    class="hts-info-btn"
                                                                                    title="View details"
                                                                                    onclick='event.stopPropagation(); showDetails(${JSON.stringify(item).replace(/'/g, "&apos;")}, "${exportingCountry}")'
                                                                                >
                                                                                    i
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                
                                                                        <td>
                                                                            ${highlightedDescription}
                                                                            ${genderBadge}
                                                                        </td>
                                                                        <td>${getRateLabel(rateInfo.column)}</td>
                                                                        <td>${rateInfo.value}</td>
                                                                        <td>${rateInfo.additionalDuty ?? ''}</td>
                                                                        ${showReciprocal ? `<td>${rateInfo.reciprocalTariff ?? ''}</td>` : ''}
                                                                        <td>${rateInfo.totalDuty ?? ''}</td>
                                                                    </tr>
                                                                `;
                                                            });
                                
                                
                                                            html += '</tbody></table></div>';
                                                        }
                                
                                                        if (secondaryResults.length > 0) {
                                                            html += `
                                                                <div class="other-results">
                                                                    <button class="other-results-toggle" onclick="toggleOtherResults()">
                                                                        <span>Related results (${secondaryResults.length})</span>
                                                                        <span class="arrow">▼</span>
                                                                    </button>
                                                                    <div class="other-results-content" id="otherResultsContent">
                                                                        <div class="table-wrap">
                                                                        <table class="results-table">
                                                                            <thead>
                                                                                <tr>
                                                                                    <th>#</th>
                                                                                    <th>HTS Code</th>
                                                                                    <th>Description</th>
                                                                                    <th>Rate Type</th>
                                                                                    <th>Rate</th>
                                                                                    <th>Additional Duty</th>
                                                                                    ${showReciprocal ? '<th>Reciprocal Tariff</th>' : ''}
                                                                                    <th>Total Duty Rate</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                            `;
                                
                                                            secondaryResults.forEach((item, index) => {
                                                                const fullDescription = getFullDescription(item);
                                                                const highlightedDescription = highlightInheritedParts(fullDescription,item.description,searchWords,genderTerms,fabricTerms,featureTerms);
                                                                const rateInfo = COUNTRY_ENGINE.getDutyRate(
                                                                    item,
                                                                    exportingCountry,
                                                                    findParentWithRate
                                                                );
                                
                                                                const leafGenders = getGenderFromLeafAndParent(item);
                                
                                                                // 1️⃣ Normalize description for gender detection
                                                                const normalizedDesc = fullDescription
                                                                    .replace(/\(\d+\)/g, '')   // remove numeric codes like (359)
                                                                    .replace(/>/g, '')         // remove > symbols
                                                                    .replace(/[':]/g, '')      // remove quotes and colons
                                                                    .toLowerCase();            // lowercase for easier matching
                                
                                                                // 2️⃣ Detect if description already contains any gender
                                                                const genders = ['men','women','boys','girls'];
                                                                const descriptionHasGender = genders.some(g => normalizedDesc.includes(g));
                                
                                                                // 3️⃣ Only add badge if description doesn't already include that gender
                                                                const uniqueGenders = leafGenders?.filter(g => !normalizedDesc.includes(g.toLowerCase()));
                                                                const genderBadge = !descriptionHasGender && uniqueGenders && uniqueGenders.length
                                                                    ? `<span class="gender-badge">${uniqueGenders.join(" / ")}</span>`
                                                                    : '';
                                
                                                                html += `
                                                                    <tr onclick='event.stopPropagation(); showDetails(${JSON.stringify(item).replace(/'/g, "&apos;")}, "${exportingCountry}")'>
                                                                        <td class="row-number">${index + 1}</td>
                                                                        <td>
                                                                    <div class="hts-code-wrapper">
                                                                        <a
                                                                            href="https://hts.usitc.gov/search?query=${encodeURIComponent(item.htsno)}"
                                                                            target="_blank"
                                                                            class="hts-code-link"
                                                                            title="View HTS Code Structure on USITC Website"
                                                                            onclick="event.stopPropagation()"
                                                                        >
                                                                            ${item.htsno}
                                                                        </a>
                                
                                                                        <button
                                                                            class="hts-info-btn"
                                                                            title="View details"
                                                                            onclick='event.stopPropagation(); showDetails(${JSON.stringify(item).replace(/'/g, "&apos;")}, "${exportingCountry}")'
                                                                        >
                                                                            i
                                                                        </button>
                                                                    </div>
                                                                </td>
                                
                                                                        <td>${highlightedDescription}</td>
                                                                        <td>${getRateLabel(rateInfo.column)}</td>
                                                                        <td>${rateInfo.value}</td>
                                                                        <td>${rateInfo.additionalDuty ?? ''}</td>
                                                                        ${showReciprocal ? `<td>${rateInfo.reciprocalTariff ?? ''}</td>` : ''}
                                                                        <td>${rateInfo.totalDuty ?? ''}</td>
                                                                    </tr>
                                                                `;
                                                            });
                                
                                                            html += `
                                                                            </tbody>
                                                                        </table>
                                                                        </div>
                                                                    </div>
                                                            `;
                                                        }
                                
                                                        container.innerHTML = html;
                                                    }


    