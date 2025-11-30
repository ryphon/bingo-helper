class BingoTracker {
    constructor() {
        this.tiles = this.loadTiles();
        this.currentTile = null;
        this.items = [];
        this.editingTileId = null;
        this.init();
        this.loadItemDatabase();
    }

    async loadItemDatabase() {
        try {
            const response = await fetch('https://prices.runescape.wiki/api/v1/osrs/mapping');
            const data = await response.json();
            this.items = data.map(item => ({
                name: item.name,
                id: item.id
            }));
        } catch (error) {
            console.error('Failed to load item database:', error);
            this.items = [];
        }
    }

    init() {
        this.renderGrid();
        this.updateStats();
        this.attachEventListeners();
    }

    parseMarkdownLinks(text) {
        if (!text) return '';
        // Parse markdown-style links [text](url)
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="note-link" onclick="event.stopPropagation()">$1</a>');
    }

    loadTiles() {
        const saved = localStorage.getItem('bingoTiles');
        return saved ? JSON.parse(saved) : this.getDefaultTiles();
    }

    saveTiles() {
        localStorage.setItem('bingoTiles', JSON.stringify(this.tiles));
    }

    getDefaultTiles() {
        return [
            {
                id: 'example1',
                name: 'Godwars Boss',
                description: 'Kill any GWD boss',
                items: [
                    { name: 'Armadyl hilt', quantity: 1, current: 0 },
                    { name: 'Bandos chestplate', quantity: 1, current: 0 },
                    { name: 'Saradomin sword', quantity: 1, current: 0 }
                ],
                completed: false
            }
        ];
    }

    renderGrid() {
        const grid = document.getElementById('bingoGrid');
        grid.innerHTML = '';

        this.tiles.forEach((tile, index) => {
            const tileEl = document.createElement('div');
            tileEl.className = `bingo-tile ${tile.completed ? 'completed' : ''}`;
            tileEl.dataset.id = tile.id;
            tileEl.dataset.index = index;
            tileEl.draggable = true;

            const progress = this.calculateTileProgress(tile);

            tileEl.innerHTML = `
                <div class="tile-header">
                    <h3>${tile.name}</h3>
                    <div class="tile-actions">
                        <button class="edit-tile" data-id="${tile.id}">✎</button>
                        <button class="delete-tile" data-id="${tile.id}">×</button>
                    </div>
                </div>
                ${tile.description ? `<p class="tile-description">${tile.description}</p>` : ''}
                ${tile.notes ? `<div class="tile-notes">${this.parseMarkdownLinks(tile.notes)}</div>` : ''}
                ${tile.orLogic ? `<span class="or-badge">ANY</span>` : ''}
                <div class="tile-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progress.toFixed(0)}%</span>
                </div>
                <div class="tile-items">
                    ${tile.items.map((item, idx) => `
                        <div class="item ${item.current >= item.quantity ? 'item-complete' : ''}">
                            ${tile.orLogic && idx > 0 ? `<span class="or-separator">OR</span>` : ''}
                            <img src="https://oldschool.runescape.wiki/images/${encodeURIComponent(item.name.replace(/ /g, '_'))}.png"
                                 alt="${item.name}"
                                 class="item-icon"
                                 onerror="this.style.display='none'"
                                 onclick="event.stopPropagation()">
                            <div class="item-info">
                                <a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(item.name.replace(/ /g, '_'))}"
                                   target="_blank"
                                   class="item-name item-wiki-link"
                                   onclick="event.stopPropagation()">${item.name}</a>
                                ${item.source ? `<span class="item-source-label">${item.source}</span>` : ''}
                            </div>
                            <div class="item-controls-inline">
                                <button class="item-btn-inline dec" data-tile-id="${tile.id}" data-item-idx="${idx}" onclick="event.stopPropagation()">-</button>
                                <span class="item-count">${item.current}/${item.quantity}</span>
                                <button class="item-btn-inline inc" data-tile-id="${tile.id}" data-item-idx="${idx}" onclick="event.stopPropagation()">+</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // No click handler needed - all interactions on tile itself

            grid.appendChild(tileEl);
        });

        // Add delete button listeners
        document.querySelectorAll('.delete-tile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTile(btn.dataset.id);
            });
        });

        // Add edit button listeners
        document.querySelectorAll('.edit-tile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editTile(btn.dataset.id);
            });
        });

        // Add inline item control listeners
        document.querySelectorAll('.item-btn-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tileId = btn.dataset.tileId;
                const itemIdx = parseInt(btn.dataset.itemIdx);
                const tile = this.tiles.find(t => t.id === tileId);

                if (!tile) return;

                const item = tile.items[itemIdx];
                if (btn.classList.contains('inc') && item.current < item.quantity) {
                    item.current++;
                } else if (btn.classList.contains('dec') && item.current > 0) {
                    item.current--;
                }

                this.updateTileCompletion(tile);
                this.saveTiles();
                this.renderGrid();
                this.updateStats();
            });
        });

        // Add drag and drop listeners
        let draggedElement = null;

        document.querySelectorAll('.bingo-tile').forEach(tile => {
            tile.addEventListener('dragstart', (e) => {
                draggedElement = tile;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', tile.dataset.index);
                setTimeout(() => tile.classList.add('dragging'), 0);
            });

            tile.addEventListener('dragend', (e) => {
                tile.classList.remove('dragging');
                document.querySelectorAll('.bingo-tile').forEach(t => t.classList.remove('drag-over'));
            });

            tile.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedElement !== tile) {
                    const grid = document.getElementById('bingoGrid');
                    const allTiles = [...grid.querySelectorAll('.bingo-tile:not(.dragging)')];
                    const draggingIndex = parseInt(draggedElement.dataset.index);
                    const targetIndex = allTiles.indexOf(tile);

                    if (targetIndex > -1) {
                        const afterElement = draggingIndex < targetIndex ?
                            tile.nextElementSibling : tile;
                        grid.insertBefore(draggedElement, afterElement);
                    }
                }
            });

            tile.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(tile.dataset.index);

                if (fromIndex !== toIndex) {
                    const [movedTile] = this.tiles.splice(fromIndex, 1);
                    this.tiles.splice(toIndex, 0, movedTile);
                    this.saveTiles();
                    this.renderGrid();
                }
            });
        });
    }

    calculateTileProgress(tile) {
        if (tile.items.length === 0) return 0;

        if (tile.orLogic) {
            // OR logic: any item completed = 100%
            const anyComplete = tile.items.some(item => item.current >= item.quantity);
            if (anyComplete) return 100;

            // Show progress of closest item
            const maxProgress = Math.max(...tile.items.map(item =>
                Math.min(item.current / item.quantity, 1)
            ));
            return maxProgress * 100;
        } else {
            // AND logic: all items must be complete
            let totalProgress = 0;
            tile.items.forEach(item => {
                totalProgress += Math.min(item.current / item.quantity, 1);
            });
            return (totalProgress / tile.items.length) * 100;
        }
    }

    openModal(tileId) {
        const tile = this.tiles.find(t => t.id === tileId);
        if (!tile) return;

        this.currentTile = tile;
        const modal = document.getElementById('tileModal');

        document.getElementById('modalTitle').textContent = tile.name;
        document.getElementById('modalDescription').textContent = tile.description || '';

        const itemsContainer = document.getElementById('modalItems');
        itemsContainer.innerHTML = tile.items.map((item, idx) => `
            <div class="modal-item">
                <div class="modal-item-header">
                    <a href="https://oldschool.runescape.wiki/w/${encodeURIComponent(item.name.replace(/ /g, '_'))}"
                       target="_blank"
                       class="item-wiki-link">${item.name}</a>
                    <span class="item-count">${item.current}/${item.quantity}</span>
                </div>
                <div class="item-controls">
                    <button class="item-btn" data-idx="${idx}" data-action="dec">-</button>
                    <input type="number"
                           class="item-input"
                           data-idx="${idx}"
                           value="${item.current}"
                           min="0"
                           max="${item.quantity}">
                    <button class="item-btn" data-idx="${idx}" data-action="inc">+</button>
                </div>
            </div>
        `).join('');

        // Attach item control listeners
        itemsContainer.querySelectorAll('.item-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                const action = btn.dataset.action;
                const item = tile.items[idx];

                if (action === 'inc' && item.current < item.quantity) {
                    item.current++;
                } else if (action === 'dec' && item.current > 0) {
                    item.current--;
                }

                this.updateTileCompletion(tile);
                this.saveTiles();
                this.renderGrid();
                this.updateStats();
                this.openModal(tileId); // Refresh modal
            });
        });

        itemsContainer.querySelectorAll('.item-input').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.idx);
                const value = Math.max(0, Math.min(parseInt(input.value) || 0, tile.items[idx].quantity));
                tile.items[idx].current = value;

                this.updateTileCompletion(tile);
                this.saveTiles();
                this.renderGrid();
                this.updateStats();
                this.openModal(tileId); // Refresh modal
            });
        });

        const toggleBtn = document.getElementById('modalToggle');
        toggleBtn.textContent = tile.completed ? 'Mark Incomplete' : 'Mark Complete';
        toggleBtn.onclick = () => {
            tile.completed = !tile.completed;
            if (tile.completed) {
                tile.items.forEach(item => item.current = item.quantity);
            }
            this.saveTiles();
            this.renderGrid();
            this.updateStats();
            modal.style.display = 'none';
        };

        modal.style.display = 'block';
    }

    updateTileCompletion(tile) {
        if (tile.orLogic) {
            // OR logic: any item complete = tile complete
            tile.completed = tile.items.some(item => item.current >= item.quantity);
        } else {
            // AND logic: all items complete = tile complete
            tile.completed = tile.items.every(item => item.current >= item.quantity);
        }
    }

    deleteTile(tileId) {
        if (confirm('Delete this tile?')) {
            this.tiles = this.tiles.filter(t => t.id !== tileId);
            this.saveTiles();
            this.renderGrid();
            this.updateStats();
        }
    }

    editTile(tileId) {
        const tile = this.tiles.find(t => t.id === tileId);
        if (!tile) return;

        // Store that we're editing and preserve progress
        this.editingTileId = tileId;

        // Populate form with tile data
        document.getElementById('tileName').value = tile.name;
        document.getElementById('tileDescription').value = tile.description || '';
        document.getElementById('tileNotes').value = tile.notes || '';
        document.getElementById('orLogic').checked = tile.orLogic || false;

        // Clear and populate items
        const container = document.getElementById('itemsContainer');
        container.innerHTML = '';

        tile.items.forEach((item, idx) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-input';
            itemDiv.innerHTML = `
                <div class="autocomplete-wrapper">
                    <input type="text" class="item-name" placeholder="Item name" required autocomplete="off" value="${item.name}">
                    <div class="autocomplete-dropdown"></div>
                </div>
                <input type="number" class="item-quantity" placeholder="Qty" value="${item.quantity}" min="1">
                <input type="text" class="item-source" placeholder="Source (optional)" value="${item.source || ''}">
                <button type="button" class="remove-item">×</button>
            `;
            container.appendChild(itemDiv);

            itemDiv.querySelector('.remove-item').addEventListener('click', () => {
                if (container.children.length > 1) {
                    itemDiv.remove();
                }
            });

            this.setupAutocomplete(itemDiv.querySelector('.item-name'));
        });

        // Update button text
        const submitBtn = document.querySelector('#addTileForm button[type="submit"]');
        submitBtn.textContent = 'Update Tile';

        // Scroll to form
        document.getElementById('addTileForm').scrollIntoView({ behavior: 'smooth' });
    }

    updateStats() {
        const completed = this.tiles.filter(t => t.completed).length;
        const total = this.tiles.length;
        const percent = total > 0 ? ((completed / total) * 100).toFixed(0) : 0;

        document.getElementById('completedCount').textContent = completed;
        document.getElementById('totalCount').textContent = total;
        document.getElementById('progressPercent').textContent = `${percent}%`;
    }

    attachEventListeners() {
        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('tileModal').style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            const modal = document.getElementById('tileModal');
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Add item to form
        document.getElementById('addItem').addEventListener('click', () => {
            const container = document.getElementById('itemsContainer');
            const newItem = document.createElement('div');
            newItem.className = 'item-input';
            newItem.innerHTML = `
                <div class="autocomplete-wrapper">
                    <input type="text" class="item-name" placeholder="Item name" required autocomplete="off">
                    <div class="autocomplete-dropdown"></div>
                </div>
                <input type="number" class="item-quantity" placeholder="Qty" value="1" min="1">
                <input type="text" class="item-source" placeholder="Source (optional)">
                <button type="button" class="remove-item">×</button>
            `;
            container.appendChild(newItem);

            newItem.querySelector('.remove-item').addEventListener('click', () => {
                if (container.children.length > 1) {
                    newItem.remove();
                }
            });

            this.setupAutocomplete(newItem.querySelector('.item-name'));
        });

        // Remove item listeners for initial item
        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const container = document.getElementById('itemsContainer');
                if (container.children.length > 1) {
                    btn.parentElement.remove();
                }
            });
        });

        // Add tile form
        document.getElementById('addTileForm').addEventListener('submit', (e) => {
            e.preventDefault();

            const name = document.getElementById('tileName').value.trim();
            const description = document.getElementById('tileDescription').value.trim();
            const notes = document.getElementById('tileNotes').value.trim();
            const orLogic = document.getElementById('orLogic').checked;
            const itemInputs = document.querySelectorAll('.item-input');

            const items = Array.from(itemInputs).map(input => ({
                name: input.querySelector('.item-name').value.trim(),
                quantity: parseInt(input.querySelector('.item-quantity').value) || 1,
                source: input.querySelector('.item-source').value.trim(),
                current: 0
            })).filter(item => item.name);

            if (name && items.length > 0) {
                if (this.editingTileId) {
                    // Update existing tile
                    const tileIndex = this.tiles.findIndex(t => t.id === this.editingTileId);
                    if (tileIndex !== -1) {
                        const existingTile = this.tiles[tileIndex];
                        // Preserve current progress
                        items.forEach((newItem, idx) => {
                            if (existingTile.items[idx]) {
                                newItem.current = existingTile.items[idx].current;
                            }
                        });

                        this.tiles[tileIndex] = {
                            ...existingTile,
                            name,
                            description,
                            notes,
                            items,
                            orLogic
                        };

                        this.updateTileCompletion(this.tiles[tileIndex]);
                    }
                    this.editingTileId = null;
                } else {
                    // Add new tile
                    this.tiles.push({
                        id: Date.now().toString(),
                        name,
                        description,
                        notes,
                        items,
                        orLogic,
                        completed: false
                    });
                }

                this.saveTiles();
                this.renderGrid();
                this.updateStats();

                // Reset form
                e.target.reset();
                const container = document.getElementById('itemsContainer');
                container.innerHTML = `
                    <div class="item-input">
                        <div class="autocomplete-wrapper">
                            <input type="text" class="item-name" placeholder="Item name" required autocomplete="off">
                            <div class="autocomplete-dropdown"></div>
                        </div>
                        <input type="number" class="item-quantity" placeholder="Qty" value="1" min="1">
                        <input type="text" class="item-source" placeholder="Source (optional)">
                        <button type="button" class="remove-item">×</button>
                    </div>
                `;

                // Reset button text
                const submitBtn = document.querySelector('#addTileForm button[type="submit"]');
                submitBtn.textContent = 'Add Tile';

                // Re-attach remove listener and autocomplete
                container.querySelector('.remove-item').addEventListener('click', (e) => {
                    if (container.children.length > 1) {
                        e.target.parentElement.parentElement.remove();
                    }
                });
                this.setupAutocomplete(container.querySelector('.item-name'));
            }
        });

        // Setup initial autocomplete
        this.setupAutocomplete(document.querySelector('.item-name'));

        // Toggle form visibility
        document.getElementById('toggleFormBtn').addEventListener('click', () => {
            const form = document.getElementById('addTileForm');
            const btn = document.getElementById('toggleFormBtn');

            if (form.style.display === 'none') {
                form.style.display = 'flex';
                btn.textContent = '▲ Hide';
            } else {
                form.style.display = 'none';
                btn.textContent = '▼ Show';
            }
        });

        // Clear progress
        document.getElementById('clearProgress').addEventListener('click', () => {
            if (confirm('Clear all progress? This will reset all item counts but keep your tiles.')) {
                this.tiles.forEach(tile => {
                    tile.completed = false;
                    tile.items.forEach(item => item.current = 0);
                });
                this.saveTiles();
                this.renderGrid();
                this.updateStats();
            }
        });

        // Export
        document.getElementById('exportData').addEventListener('click', () => {
            const data = JSON.stringify(this.tiles, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bingo-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Import
        document.getElementById('importData').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const imported = JSON.parse(event.target.result);
                            if (Array.isArray(imported)) {
                                this.tiles = imported;
                                this.saveTiles();
                                this.renderGrid();
                                this.updateStats();
                            }
                        } catch (err) {
                            alert('Invalid file format');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        });
    }

    setupAutocomplete(input) {
        if (!input) return;

        const wrapper = input.parentElement;
        const dropdown = wrapper.querySelector('.autocomplete-dropdown');

        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            dropdown.innerHTML = '';

            if (value.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = this.items
                .filter(item => item.name.toLowerCase().includes(value))
                .slice(0, 10);

            if (matches.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            matches.forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = item.name;
                div.addEventListener('click', () => {
                    input.value = item.name;
                    dropdown.style.display = 'none';
                });
                dropdown.appendChild(div);
            });

            dropdown.style.display = 'block';
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });

        input.addEventListener('focus', (e) => {
            if (e.target.value.length >= 2) {
                const event = new Event('input');
                e.target.dispatchEvent(event);
            }
        });
    }
}

// Initialize
new BingoTracker();
