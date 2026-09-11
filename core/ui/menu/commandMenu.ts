export type CommandMenuIcon =
  | 'focus'
  | 'expand'
  | 'collapse'
  | 'copy'
  | 'layout'
  | 'reset';

export type CommandMenuItem = Readonly<{
  id: string;
  label: string;
  icon?: CommandMenuIcon;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  children?: readonly CommandMenuEntry[];
  action?: () => void;
}>;

export type CommandMenuEntry = CommandMenuItem | Readonly<{ type: 'separator'; id?: string }>;

export type CommandMenuHandle = Readonly<{ close(): void }>;

type PointAnchor = Readonly<{ type: 'point'; x: number; y: number }>;
type ElementAnchor = Readonly<{
  type: 'element';
  element: HTMLElement;
  align?: 'start' | 'end';
}>;

export type CommandMenuAnchor = PointAnchor | ElementAnchor;

export type OpenCommandMenuOptions = Readonly<{
  anchor: CommandMenuAnchor;
  items: readonly CommandMenuEntry[];
  ariaLabel?: string;
}>;

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const VIEWPORT_GAP = 8;

let activeMenu: { id: number; close: () => void } | null = null;
let nextMenuId = 1;

const iconPaths: Record<CommandMenuIcon, readonly string[]> = {
  focus: ['M8 2v2', 'M8 12v2', 'M2 8h2', 'M12 8h2', 'M8 5.25A2.75 2.75 0 1 0 8 10.75 2.75 2.75 0 0 0 8 5.25Z'],
  expand: ['M4 2H2v2', 'M12 2h2v2', 'M4 14H2v-2', 'M12 14h2v-2', 'M5 8h6', 'M8 5v6'],
  collapse: ['M4 2H2v2', 'M12 2h2v2', 'M4 14H2v-2', 'M12 14h2v-2', 'M5 8h6'],
  copy: ['M5 5h8v8H5z', 'M3 11H2V2h9v1'],
  layout: ['M2 3h12v10H2z', 'M6 3v10', 'M6 7h8'],
  reset: ['M3.1 5.2A5.5 5.5 0 1 1 2.7 10', 'M2 3v3h3'],
};

const createSvg = (paths: readonly string[], className: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.classList.add(className);
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  paths.forEach((data) => {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', data);
    svg.append(path);
  });
  return svg;
};

const isMenuItem = (entry: CommandMenuEntry): entry is CommandMenuItem => !('type' in entry);

const directButtons = (menu: HTMLElement): HTMLButtonElement[] => Array.from(menu.children)
  .flatMap((child) => {
    if (!(child instanceof HTMLElement) || !child.classList.contains('command-menu-entry')) return [];
    const button = child.firstElementChild;
    return button instanceof HTMLButtonElement && !button.disabled ? [button] : [];
  });

const closeChildMenus = (menu: HTMLElement, except?: HTMLElement): void => {
  Array.from(menu.children).forEach((child) => {
    if (!(child instanceof HTMLElement) || child === except) return;
    child.classList.remove('is-submenu-open');
    const button = child.firstElementChild;
    if (button instanceof HTMLButtonElement && button.hasAttribute('aria-haspopup')) {
      button.setAttribute('aria-expanded', 'false');
    }
  });
};

const devicePixelRatio = (): number => Math.max(1, window.devicePixelRatio || 1);

const snapToDevicePixel = (value: number): number => {
  const ratio = devicePixelRatio();
  return Math.round(value * ratio) / ratio;
};

const alignSeparatorHairlines = (root: HTMLElement): void => {
  const ratio = devicePixelRatio();
  const hairlineHeight = 1 / ratio;
  root.style.setProperty('--command-menu-hairline', `${hairlineHeight}px`);
  root.querySelectorAll<HTMLElement>('.command-menu-separator').forEach((separator) => {
    const bounds = separator.getBoundingClientRect();
    const centeredTop = bounds.top + (bounds.height - hairlineHeight) / 2;
    const physicalPixelTop = Math.round(centeredTop * ratio) / ratio;
    separator.style.setProperty('--command-menu-separator-top', `${physicalPixelTop - bounds.top}px`);
  });
};

const placeSubmenu = (entry: HTMLElement, submenu: HTMLElement): void => {
  submenu.classList.remove('opens-left');
  submenu.style.top = '-5px';
  let bounds = submenu.getBoundingClientRect();
  if (bounds.right > window.innerWidth - VIEWPORT_GAP) {
    submenu.classList.add('opens-left');
    bounds = submenu.getBoundingClientRect();
  }
  let top = -5;
  if (bounds.bottom > window.innerHeight - VIEWPORT_GAP) {
    top -= bounds.bottom - (window.innerHeight - VIEWPORT_GAP);
  }
  if (bounds.top + (top + 5) < VIEWPORT_GAP) {
    top += VIEWPORT_GAP - (bounds.top + (top + 5));
  }
  submenu.style.top = `${top}px`;
  entry.classList.add('is-submenu-open');
  alignSeparatorHairlines(submenu);
};

const openChildMenu = (entry: HTMLElement, focusFirst: boolean): void => {
  const menu = entry.parentElement;
  const button = entry.firstElementChild;
  const submenu = entry.lastElementChild;
  if (!(menu instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || !(submenu instanceof HTMLElement)) return;
  closeChildMenus(menu, entry);
  entry.classList.add('is-submenu-open');
  button.setAttribute('aria-expanded', 'true');
  placeSubmenu(entry, submenu);
  if (focusFirst) directButtons(submenu)[0]?.focus({ preventScroll: true });
};

const createMenuElement = (items: readonly CommandMenuEntry[], closeAll: () => void): HTMLDivElement => {
  const menu = document.createElement('div');
  menu.className = 'command-menu';
  menu.setAttribute('role', 'menu');

  items.forEach((item) => {
    if (!isMenuItem(item)) {
      const separator = document.createElement('div');
      separator.className = 'command-menu-separator';
      separator.setAttribute('role', 'separator');
      menu.append(separator);
      return;
    }

    const entry = document.createElement('div');
    entry.className = 'command-menu-entry';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'command-menu-button';
    button.disabled = item.disabled === true;
    button.dataset.commandMenuItem = item.id;
    if (item.danger) button.classList.add('is-danger');
    if (item.checked !== undefined) {
      button.setAttribute('role', 'menuitemcheckbox');
      button.setAttribute('aria-checked', String(item.checked));
    } else {
      button.setAttribute('role', 'menuitem');
    }

    const iconSlot = document.createElement('span');
    iconSlot.className = 'command-menu-icon-slot';
    if (item.checked) {
      iconSlot.append(createSvg(['m3 8 3 3 7-7'], 'command-menu-icon'));
    } else if (item.icon) {
      iconSlot.append(createSvg(iconPaths[item.icon], 'command-menu-icon'));
    }
    const label = document.createElement('span');
    label.className = 'command-menu-label';
    label.textContent = item.label;
    button.append(iconSlot, label);

    if (item.children?.length) {
      const arrow = createSvg(['m6 3 5 5-5 5'], 'command-menu-arrow');
      button.append(arrow);
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      const submenu = createMenuElement(item.children, closeAll);
      submenu.classList.add('command-submenu');
      entry.append(button, submenu);
      entry.addEventListener('pointerenter', () => openChildMenu(entry, false));
      button.addEventListener('click', () => openChildMenu(entry, true));
    } else {
      if (item.shortcut) {
        const shortcut = document.createElement('span');
        shortcut.className = 'command-menu-shortcut';
        shortcut.textContent = item.shortcut;
        button.append(shortcut);
      }
      button.addEventListener('click', () => {
        if (button.disabled) return;
        closeAll();
        item.action?.();
      });
      entry.append(button);
      entry.addEventListener('pointerenter', () => closeChildMenus(menu));
    }
    menu.append(entry);
  });

  menu.addEventListener('keydown', (event) => {
    menu.closest('.command-menu-layer')?.classList.add('is-keyboard-navigation');
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.closest('.command-menu') !== menu) return;
    const buttons = directButtons(menu);
    const index = buttons.indexOf(target);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(index + step + buttons.length) % buttons.length]?.focus({ preventScroll: true });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowRight' && target.hasAttribute('aria-haspopup')) {
      event.preventDefault();
      const entry = target.parentElement;
      if (entry) openChildMenu(entry, true);
    } else if (event.key === 'ArrowLeft' && menu.classList.contains('command-submenu')) {
      event.preventDefault();
      const entry = menu.parentElement;
      entry?.classList.remove('is-submenu-open');
      const parentButton = entry?.firstElementChild;
      if (parentButton instanceof HTMLButtonElement) {
        parentButton.setAttribute('aria-expanded', 'false');
        parentButton.focus({ preventScroll: true });
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAll();
    }
  });
  return menu;
};

const placeRootMenu = (menu: HTMLElement, anchor: CommandMenuAnchor): void => {
  const bounds = menu.getBoundingClientRect();
  let left: number;
  let top: number;
  if (anchor.type === 'point') {
    left = anchor.x + 2;
    top = anchor.y + 2;
  } else {
    const anchorBounds = anchor.element.getBoundingClientRect();
    left = anchor.align === 'end' ? anchorBounds.right - bounds.width : anchorBounds.left;
    top = anchorBounds.bottom + 5;
    if (top + bounds.height > window.innerHeight - VIEWPORT_GAP) top = anchorBounds.top - bounds.height - 5;
  }
  left = Math.min(Math.max(VIEWPORT_GAP, left), Math.max(VIEWPORT_GAP, window.innerWidth - bounds.width - VIEWPORT_GAP));
  top = Math.min(Math.max(VIEWPORT_GAP, top), Math.max(VIEWPORT_GAP, window.innerHeight - bounds.height - VIEWPORT_GAP));
  menu.style.left = `${snapToDevicePixel(left)}px`;
  menu.style.top = `${snapToDevicePixel(top)}px`;
};

export const closeCommandMenu = (): void => activeMenu?.close();

export const openCommandMenu = (options: OpenCommandMenuOptions): CommandMenuHandle => {
  closeCommandMenu();
  const id = nextMenuId++;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const layer = document.createElement('div');
  layer.className = 'command-menu-layer';
  const cleanupCallbacks: Array<() => void> = [];
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    cleanupCallbacks.forEach((cleanup) => cleanup());
    layer.remove();
    if (activeMenu?.id === id) activeMenu = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  };
  activeMenu = { id, close };
  const menu = createMenuElement(options.items, close);
  menu.classList.add('command-menu-root');
  menu.setAttribute('aria-label', options.ariaLabel ?? '操作菜单');
  layer.append(menu);
  document.body.append(layer);
  placeRootMenu(menu, options.anchor);
  alignSeparatorHairlines(layer);

  const onPointerDown = (event: PointerEvent): void => {
    if (event.target instanceof Node && !layer.contains(event.target)) close();
  };
  const onContextMenu = (event: MouseEvent): void => {
    if (event.target instanceof Node && !layer.contains(event.target)) close();
  };
  const onWindowChange = (): void => close();
  const onPointerMove = (): void => layer.classList.remove('is-keyboard-navigation');
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !layer.contains(document.activeElement)) {
      const buttons = directButtons(menu);
      if (!buttons.length) return;
      event.preventDefault();
      layer.classList.add('is-keyboard-navigation');
      buttons[event.key === 'ArrowDown' ? 0 : buttons.length - 1]?.focus({ preventScroll: true });
    }
  };
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('keydown', onDocumentKeyDown);
  layer.addEventListener('pointermove', onPointerMove);
  window.addEventListener('blur', onWindowChange);
  window.addEventListener('resize', onWindowChange);
  window.addEventListener('scroll', onWindowChange, true);
  cleanupCallbacks.push(
    () => document.removeEventListener('pointerdown', onPointerDown, true),
    () => document.removeEventListener('contextmenu', onContextMenu, true),
    () => document.removeEventListener('keydown', onDocumentKeyDown),
    () => layer.removeEventListener('pointermove', onPointerMove),
    () => window.removeEventListener('blur', onWindowChange),
    () => window.removeEventListener('resize', onWindowChange),
    () => window.removeEventListener('scroll', onWindowChange, true),
  );
  return Object.freeze({ close });
};

export const openCommandMenuAtPoint = (
  x: number,
  y: number,
  items: readonly CommandMenuEntry[],
  ariaLabel?: string,
): CommandMenuHandle => openCommandMenu({ anchor: { type: 'point', x, y }, items, ariaLabel });

export const openCommandMenuFromElement = (
  element: HTMLElement,
  items: readonly CommandMenuEntry[],
  options: Readonly<{ align?: 'start' | 'end'; ariaLabel?: string }> = {},
): CommandMenuHandle => openCommandMenu({
  anchor: { type: 'element', element, align: options.align },
  items,
  ariaLabel: options.ariaLabel,
});
