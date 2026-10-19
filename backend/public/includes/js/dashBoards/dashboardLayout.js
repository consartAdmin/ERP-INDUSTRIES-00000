// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dashboardLayout.js — Free dashboard layout manager                 ║
// ║ PRODNEX ERP                                                        ║
// ║                                                                      ║
// ║ ✅ Free positioning                                                  ║
// ║ ✅ Drag & drop                                                       ║
// ║ ✅ Layout saved per user                                             ║
// ║ ✅ Grid / Free mode                                                  ║
// ║ ✅ Reset layout                                                      ║
// ║ ✅ Works only with visible / authorized dashboards                   ║
// ║ ✅ Prevents cards from leaving dashboard area                        ║
// ║ ✅ Restores saved positions                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝


// ======================================================================
// CONFIG
// ======================================================================

const STORAGE_PREFIX = 'consart.dashboard.layout';

const DEFAULT_MODE = 'grid';

const FREE_MODE = 'free';

const GRID_MODE = 'grid';


// ======================================================================
// STATE
// ======================================================================

let dragState = null;


// ======================================================================
// STORAGE KEYS
// ======================================================================

function getPositionsStorageKey(userId) {
    return `${STORAGE_PREFIX}.positions.user.${userId}`;
}


function getModeStorageKey(userId) {
    return `${STORAGE_PREFIX}.mode.user.${userId}`;
}


// ======================================================================
// HELPERS
// ======================================================================

function getDashboardKey(card) {
    return (
        card?.dataset?.dashboardKey ||
        card?.dataset?.id ||
        card?.id ||
        ''
    );
}


function getVisibleCards(root) {
    if (!root) {
        return [];
    }

    return [
        ...root.querySelectorAll('.dash-card'),
    ].filter((card) => !card.hidden);
}


function getGrid(root) {
    return root?.querySelector('.dash-grid') || null;
}


// ======================================================================
// MODE STORAGE
// ======================================================================

export function getDashboardLayoutMode(userId) {
    if (!userId) {
        return DEFAULT_MODE;
    }

    const value =
        localStorage.getItem(
            getModeStorageKey(userId)
        );

    return value === FREE_MODE
        ? FREE_MODE
        : GRID_MODE;
}


function saveDashboardLayoutMode(
    userId,
    mode
) {
    if (!userId) {
        return;
    }

    localStorage.setItem(
        getModeStorageKey(userId),
        mode
    );
}


// ======================================================================
// POSITION STORAGE
// ======================================================================

function getSavedPositions(userId) {
    if (!userId) {
        return {};
    }

    const raw =
        localStorage.getItem(
            getPositionsStorageKey(userId)
        );

    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);

        return (
            parsed &&
            typeof parsed === 'object'
        )
            ? parsed
            : {};

    } catch (error) {
        console.warn(
            '[dashboardLayout] Invalid saved positions:',
            error
        );

        return {};
    }
}


function savePositions(
    root,
    userId
) {
    if (!root || !userId) {
        return;
    }

    const positions = {};

    getVisibleCards(root).forEach((card) => {
        const key = getDashboardKey(card);

        if (!key) {
            return;
        }

        positions[key] = {
            left:
                Number.parseFloat(
                    card.style.left
                ) || 0,

            top:
                Number.parseFloat(
                    card.style.top
                ) || 0,
        };
    });


    localStorage.setItem(
        getPositionsStorageKey(userId),
        JSON.stringify(positions)
    );
}


// ======================================================================
// APPLY SAVED POSITIONS
// ======================================================================

function applySavedPositions(
    root,
    userId
) {
    if (!root) {
        return;
    }

    const saved =
        getSavedPositions(userId);


    getVisibleCards(root).forEach((card) => {
        const key =
            getDashboardKey(card);

        const position =
            saved[key];


        if (!position) {
            return;
        }


        const left =
            Number(position.left) || 0;

        const top =
            Number(position.top) || 0;


        card.style.left =
            `${Math.max(0, left)}px`;

        card.style.top =
            `${Math.max(0, top)}px`;
    });
}


// ======================================================================
// FREE AREA HEIGHT
// ======================================================================

function updateFreeAreaHeight(root) {
    if (!root) {
        return;
    }


    const cards =
        getVisibleCards(root);


    let maxBottom = 0;


    cards.forEach((card) => {
        const top =
            Number.parseFloat(
                card.style.top
            ) || 0;

        const bottom =
            top + card.offsetHeight;

        maxBottom =
            Math.max(
                maxBottom,
                bottom
            );
    });


    root.style.minHeight =
        `${Math.max(
            400,
            maxBottom + 50
        )}px`;
}


// ======================================================================
// GRID → ABSOLUTE
// ======================================================================

function convertGridToFree(
    root,
    userId
) {
    const grid =
        getGrid(root);


    if (!grid) {
        console.warn(
            '[dashboardLayout] .dash-grid not found.'
        );

        return;
    }


    const cards =
        getVisibleCards(root);


    if (!cards.length) {
        return;
    }


    const rootRect =
        root.getBoundingClientRect();


    // --------------------------------------------------------
    // Capture current grid positions BEFORE changing layout
    // --------------------------------------------------------

    const positions =
        cards.map((card) => {

            const rect =
                card.getBoundingClientRect();


            return {
                card,

                left:
                    rect.left -
                    rootRect.left +
                    root.scrollLeft,

                top:
                    rect.top -
                    rootRect.top +
                    root.scrollTop,

                width:
                    rect.width,

                height:
                    rect.height,
            };
        });


    // --------------------------------------------------------
    // Prepare dashboard container
    // --------------------------------------------------------

    root.style.position =
        'relative';

    root.setAttribute(
        'data-layout-mode',
        FREE_MODE
    );


    // --------------------------------------------------------
    // Move cards outside grid
    // --------------------------------------------------------

    positions.forEach((item) => {
        const {
            card,
            left,
            top,
            width,
            height,
        } = item;


        root.appendChild(card);


        card.style.position =
            'absolute';

        card.style.left =
            `${left}px`;

        card.style.top =
            `${top}px`;

        card.style.width =
            `${width}px`;

        card.style.height =
            `${height}px`;

        card.style.margin =
            '0';

        card.style.touchAction =
            'none';

        card.style.cursor =
            'grab';
    });


    grid.style.display =
        'none';


    // --------------------------------------------------------
    // Restore saved positions
    // --------------------------------------------------------

    applySavedPositions(
        root,
        userId
    );


    // --------------------------------------------------------
    // Enable dragging
    // --------------------------------------------------------

    enableDashboardDragging(
        root,
        userId
    );


    updateFreeAreaHeight(root);
}


// ======================================================================
// FREE → GRID
// ======================================================================

function convertFreeToGrid(root) {
    const grid =
        getGrid(root);


    if (!grid) {
        return;
    }


    const cards =
        [
            ...root.querySelectorAll(
                ':scope > .dash-card'
            ),
        ];


    cards.forEach((card) => {

        card.style.position =
            '';

        card.style.left =
            '';

        card.style.top =
            '';

        card.style.width =
            '';

        card.style.height =
            '';

        card.style.margin =
            '';

        card.style.cursor =
            '';

        card.style.touchAction =
            '';


        card.onpointerdown =
            null;

        card.onpointermove =
            null;

        card.onpointerup =
            null;

        card.onpointercancel =
            null;


        grid.appendChild(card);
    });


    grid.style.display =
        '';


    root.style.minHeight =
        '';

    root.removeAttribute(
        'data-layout-mode'
    );
}


// ======================================================================
// DRAG
// ======================================================================

function enableDashboardDragging(
    root,
    userId
) {
    getVisibleCards(root)
        .forEach((card) => {

            card.onpointerdown =
                (event) => {

                    startDashboardDrag(
                        event,
                        root,
                        card,
                        userId
                    );

                };

        });
}


// ======================================================================
// START DRAG
// ======================================================================

function startDashboardDrag(
    event,
    root,
    card,
    userId
) {
    if (
        root.getAttribute(
            'data-layout-mode'
        ) !== FREE_MODE
    ) {
        return;
    }


    // Ignore controls inside cards
    if (
        event.target.closest(
            'button, a, input, select, textarea'
        )
    ) {
        return;
    }


    event.preventDefault();


    const cardRect =
        card.getBoundingClientRect();

    const rootRect =
        root.getBoundingClientRect();


    dragState = {
        root,
        card,
        userId,

        pointerId:
            event.pointerId,

        startX:
            event.clientX,

        startY:
            event.clientY,

        startLeft:
            cardRect.left -
            rootRect.left +
            root.scrollLeft,

        startTop:
            cardRect.top -
            rootRect.top +
            root.scrollTop,
    };


    card.classList.add(
        'is-dragging'
    );


    card.style.cursor =
        'grabbing';


    card.style.zIndex =
        '999';


    card.setPointerCapture(
        event.pointerId
    );


    card.onpointermove =
        handleDashboardDrag;


    card.onpointerup =
        finishDashboardDrag;


    card.onpointercancel =
        finishDashboardDrag;
}


// ======================================================================
// DRAG MOVE
// ======================================================================

function handleDashboardDrag(event) {
    if (!dragState) {
        return;
    }


    const {
        root,
        card,
        startX,
        startY,
        startLeft,
        startTop,
    } = dragState;


    const deltaX =
        event.clientX - startX;

    const deltaY =
        event.clientY - startY;


    let nextLeft =
        startLeft + deltaX;

    let nextTop =
        startTop + deltaY;


    // --------------------------------------------------------
    // Keep card inside horizontal dashboard area
    // --------------------------------------------------------

    const maxLeft =
        Math.max(
            0,
            root.clientWidth -
            card.offsetWidth
        );


    nextLeft =
        Math.max(
            0,
            Math.min(
                nextLeft,
                maxLeft
            )
        );


    // --------------------------------------------------------
    // Do not allow negative Y
    // --------------------------------------------------------

    nextTop =
        Math.max(
            0,
            nextTop
        );


    card.style.left =
        `${nextLeft}px`;

    card.style.top =
        `${nextTop}px`;


    updateFreeAreaHeight(root);
}


// ======================================================================
// END DRAG
// ======================================================================

function finishDashboardDrag(event) {
    if (!dragState) {
        return;
    }


    const {
        root,
        card,
        userId,
        pointerId,
    } = dragState;


    try {

        if (
            card.hasPointerCapture?.(
                pointerId
            )
        ) {
            card.releasePointerCapture(
                pointerId
            );
        }

    } catch {
        // Ignore capture errors
    }


    card.classList.remove(
        'is-dragging'
    );


    card.style.cursor =
        'grab';

    card.style.zIndex =
        '';


    card.onpointermove =
        null;

    card.onpointerup =
        null;

    card.onpointercancel =
        null;


    savePositions(
        root,
        userId
    );


    updateFreeAreaHeight(
        root
    );


    dragState =
        null;
}


// ======================================================================
// SET MODE
// ======================================================================

export function setDashboardLayoutMode(
    root,
    userId,
    mode
) {
    if (!root) {
        return;
    }


    const normalizedMode =
        mode === FREE_MODE
            ? FREE_MODE
            : GRID_MODE;


    saveDashboardLayoutMode(
        userId,
        normalizedMode
    );


    if (
        normalizedMode === FREE_MODE
    ) {

        convertGridToFree(
            root,
            userId
        );

    } else {

        convertFreeToGrid(
            root
        );

    }


    updateLayoutButtonState(
        root,
        normalizedMode
    );
}


// ======================================================================
// TOGGLE MODE
// ======================================================================

export function toggleDashboardLayout(
    root,
    userId
) {
    const currentMode =
        root.getAttribute(
            'data-layout-mode'
        ) === FREE_MODE
            ? FREE_MODE
            : GRID_MODE;


    const nextMode =
        currentMode === FREE_MODE
            ? GRID_MODE
            : FREE_MODE;


    setDashboardLayoutMode(
        root,
        userId,
        nextMode
    );
}


// ======================================================================
// RESET
// ======================================================================

export function resetDashboardLayout(
    root,
    userId
) {
    if (!root) {
        return;
    }


    if (userId) {

        localStorage.removeItem(
            getPositionsStorageKey(
                userId
            )
        );


        localStorage.removeItem(
            getModeStorageKey(
                userId
            )
        );

    }


    convertFreeToGrid(
        root
    );


    saveDashboardLayoutMode(
        userId,
        GRID_MODE
    );


    updateLayoutButtonState(
        root,
        GRID_MODE
    );


    console.log(
        '[dashboardLayout] Layout reset.'
    );
}


// ======================================================================
// TOOLBAR
// ======================================================================

function createLayoutToolbar(
    root,
    userId
) {
    let toolbar =
        root.querySelector(
            '.dashboard-layout-toolbar'
        );


    if (toolbar) {
        return toolbar;
    }


    toolbar =
        document.createElement(
            'div'
        );


    toolbar.className =
        'dashboard-layout-toolbar';


    toolbar.innerHTML = `
    <button
      type="button"
      class="dashboard-layout-button"
      data-dashboard-layout-action="toggle"
      title="Alternar entre layout normal e livre"
    >
      🧲 Modo livre
    </button>

    <button
      type="button"
      class="dashboard-layout-button"
      data-dashboard-layout-action="reset"
      title="Restaurar posição padrão dos dashboards"
    >
      ↺ Resetar layout
    </button>
  `;


    root.prepend(
        toolbar
    );


    toolbar
        .querySelector(
            '[data-dashboard-layout-action="toggle"]'
        )
        ?.addEventListener(
            'click',
            () => {

                toggleDashboardLayout(
                    root,
                    userId
                );

            }
        );


    toolbar
        .querySelector(
            '[data-dashboard-layout-action="reset"]'
        )
        ?.addEventListener(
            'click',
            () => {

                resetDashboardLayout(
                    root,
                    userId
                );

            }
        );


    return toolbar;
}


// ======================================================================
// BUTTON STATE
// ======================================================================

function updateLayoutButtonState(
    root,
    mode
) {
    const button =
        root.querySelector(
            '[data-dashboard-layout-action="toggle"]'
        );


    if (!button) {
        return;
    }


    if (mode === FREE_MODE) {

        button.textContent =
            '🔒 Fixar layout';

        button.title =
            'Voltar ao layout normal';

    } else {

        button.textContent =
            '🧲 Modo livre';

        button.title =
            'Ativar posicionamento livre';

    }
}


// ======================================================================
// KEYBOARD SHORTCUT
// ======================================================================

function bindKeyboardShortcut(
    root,
    userId
) {
    if (
        document.documentElement
            .dataset
            .dashboardLayoutKeyboardBound ===
        '1'
    ) {
        return;
    }


    document.documentElement
        .dataset
        .dashboardLayoutKeyboardBound =
        '1';


    document.addEventListener(
        'keydown',
        (event) => {

            if (
                event.shiftKey &&
                (
                    event.key === 'm' ||
                    event.key === 'M'
                )
            ) {

                toggleDashboardLayout(
                    root,
                    userId
                );

            }

        }
    );
}


// ======================================================================
// INIT
// ======================================================================

export function initDashboardLayout(
    root,
    userId
) {
    if (!root) {
        console.warn(
            '[dashboardLayout] Root not found.'
        );

        return;
    }


    if (!userId) {
        console.warn(
            '[dashboardLayout] User ID not provided.'
        );

        return;
    }


    root.style.position =
        'relative';


    // --------------------------------------------------------
    // Toolbar
    // --------------------------------------------------------

    createLayoutToolbar(
        root,
        userId
    );


    // --------------------------------------------------------
    // Keyboard shortcut
    // --------------------------------------------------------

    bindKeyboardShortcut(
        root,
        userId
    );


    // --------------------------------------------------------
    // Restore saved mode
    // --------------------------------------------------------

    const savedMode =
        getDashboardLayoutMode(
            userId
        );


    if (
        savedMode === FREE_MODE
    ) {

        requestAnimationFrame(
            () => {

                convertGridToFree(
                    root,
                    userId
                );


                updateLayoutButtonState(
                    root,
                    FREE_MODE
                );

            }
        );

    } else {

        updateLayoutButtonState(
            root,
            GRID_MODE
        );

    }


    console.log(
        '[dashboardLayout] Initialized.',
        {
            userId,
            mode: savedMode,
        }
    );
}