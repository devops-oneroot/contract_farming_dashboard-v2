import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type RefObject, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
export declare const cx: (...c: (string | false | null | undefined)[]) => string;
/** Action colours used everywhere: add / new = green, edit = yellow, delete / remove = red (danger) */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "add" | "edit";
export declare function Button({ variant, size, loading, loadingText, icon, className, children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
    loading?: boolean;
    /** Label shown next to the spinner while loading (icon-only buttons show just the spinner) */
    loadingText?: ReactNode;
    icon?: ReactNode;
}): import("react").JSX.Element;
/** `isPassword` hides the text and adds an eye button at the right end to show / hide it */
export declare function Input({ className, isPassword, ...props }: InputHTMLAttributes<HTMLInputElement> & {
    isPassword?: boolean;
}): import("react").JSX.Element;
/**
 * Drop-in replacement for a native <select>: same `value`, `onChange={(e) => … e.target.value}` and
 * <option>/<optgroup> children, rendered with the common Dropdown. Lists over 10 options get a search box
 * unless `isSearch` says otherwise.
 */
export declare function Select({ className, children, value, onChange, disabled, isSearch, "aria-label": ariaLabel, title, id, }: SelectHTMLAttributes<HTMLSelectElement> & {
    isSearch?: boolean;
}): import("react").JSX.Element;
/**
 * Drop-in replacement for <Input type="date">: same `value` ("YYYY-MM-DD" or ""), `onChange={(e) => … e.target.value}`,
 * `min`, `max` and `required`. Opens the common themed calendar; click the month or year in its header to jump
 * straight to another month / year. Keys: arrows move a day / week, PageUp / PageDown a month (with Shift a year),
 * Home / End the week's ends, Enter picks, Esc closes.
 */
export declare function DateInput({ value, onChange, min, max, required, disabled, className, placeholder, id, title, autoFocus, "aria-label": ariaLabel, }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "min" | "max"> & {
    value: string;
    min?: string;
    max?: string;
}): import("react").JSX.Element;
export interface DropdownOption {
    value: string;
    label: string;
    /** Muted text shown after the label (and searched too), e.g. a code or city */
    hint?: string;
    /** Muted text on its own line under the label in the list (and searched too), e.g. a product code */
    detail?: string;
    /** Heading the option is listed under */
    group?: string;
}
/**
 * Styled dropdown: single choice, or with `multiple` a checkbox on every row (values / onValuesChange; the list
 * stays open while ticking). `isSearch` adds a filter box at the top of the list.
 * The list opens in a layer above the page, so modals and scrolling tables don't clip it.
 * A value missing from `options` (e.g. a legacy one) still shows as the selection.
 */
export declare function Dropdown({ options, value, onChange, multiple, values, onValuesChange, placeholder, isSearch, searchPlaceholder, emptyText, allowClear, bare, anchor, rowActions, footer, disabled, className, title, id, "aria-label": ariaLabel, }: {
    options: DropdownOption[];
    value?: string;
    onChange?: (value: string) => void;
    /** Checkbox on every row: any number can be ticked */
    multiple?: boolean;
    /** Ticked values (with `multiple`) */
    values?: string[];
    onValuesChange?: (values: string[]) => void;
    placeholder?: string;
    isSearch?: boolean;
    searchPlaceholder?: string;
    emptyText?: string;
    /** Adds a "None" row that clears the value */
    allowClear?: boolean;
    /** No border or background, for a dropdown sitting inside its own styled box (e.g. the top bar) */
    bare?: boolean;
    /** Element the list lines up with (left edge and width) instead of the button, e.g. the box a bare dropdown sits in */
    anchor?: RefObject<HTMLElement | null>;
    /** Buttons at the end of an option's row (e.g. edit / delete); clicking one closes the list */
    rowActions?: (option: DropdownOption) => ReactNode;
    /** Pinned under the list (e.g. an "Add new" button); clicking it closes the list */
    footer?: ReactNode;
    disabled?: boolean;
    className?: string;
    title?: string;
    id?: string;
    "aria-label"?: string;
}): import("react").JSX.Element;
export declare function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): import("react").JSX.Element;
export declare function Field({ label, hint, required, className, children, }: {
    label: string;
    hint?: string;
    required?: boolean;
    className?: string;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function Checkbox({ label, checked, onChange, indeterminate, disabled, title, "aria-label": ariaLabel, }: {
    /** Leave out for a bare checkbox (e.g. table row selection) and pass aria-label instead */
    label?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    /** Partly-ticked state, e.g. a "select all" box when only some rows are picked */
    indeterminate?: boolean;
    disabled?: boolean;
    title?: string;
    "aria-label"?: string;
}): import("react").JSX.Element;
export declare function SearchInput({ value, onChange, placeholder, className, autoFocus, }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}): import("react").JSX.Element;
export declare function PageHeader({ title, subtitle, actions, }: {
    title: ReactNode;
    subtitle?: ReactNode;
    actions?: ReactNode;
}): import("react").JSX.Element;
/**
 * The filter row at the top of a list card. Search and filters sit at the right end and wrap right-aligned; the
 * search box keeps a fixed width there. Phones: each control keeps its own (usually full) width.
 */
export declare function FilterBar({ children, className }: {
    children: ReactNode;
    className?: string;
}): import("react").JSX.Element;
export declare function Card({ title, actions, className, bodyClassName, children, }: {
    title?: ReactNode;
    actions?: ReactNode;
    className?: string;
    bodyClassName?: string;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function StatCard({ label, value, sub, icon, tone, }: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    icon?: ReactNode;
    tone?: "slate" | "green" | "amber" | "red" | "blue";
}): import("react").JSX.Element;
type Tone = "slate" | "green" | "amber" | "red" | "blue" | "violet";
export declare function Badge({ tone, children }: {
    tone?: Tone;
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Wrapper giving tables consistent styling; use <Th>/<Td> inside.
 * Phones: every row is a card (see TableStack). `stack={false}` keeps the plain table, for tables with their own
 * phone layout.
 */
export declare function Table({ children, className, stack }: {
    children: ReactNode;
    className?: string;
    stack?: boolean;
}): import("react").JSX.Element;
/**
 * The box around a <table> (its direct child) that turns the rows into cards on phones (`.table-stack` in
 * styles/index.css): each cell labelled with its column's header, the first named column as the card's title and an
 * "Actions" column as its footer. <Table> uses it; wrap a hand-built table in it to get the same.
 */
export declare function TableStack({ children, className, stack }: {
    children: ReactNode;
    className?: string;
    stack?: boolean;
}): import("react").JSX.Element;
export declare function Th({ children, className, right, center }: {
    children?: ReactNode;
    className?: string;
    right?: boolean;
    center?: boolean;
}): import("react").JSX.Element;
export declare function Td({ children, className, right, center, colSpan, }: {
    children?: ReactNode;
    className?: string;
    right?: boolean;
    center?: boolean;
    colSpan?: number;
}): import("react").JSX.Element;
/** Header of a list's row-actions column: "Actions", centred */
export declare function ActionsTh({ className, right }: {
    className?: string;
    right?: boolean;
}): import("react").JSX.Element;
/** Row-actions cell of a list: its buttons centred under the Actions header, or at the right end with `right` */
export declare function ActionsTd({ children, className, right }: {
    children?: ReactNode;
    className?: string;
    right?: boolean;
}): import("react").JSX.Element;
declare const ROW_ACTION: {
    readonly view: {
        readonly icon: import("lucide-react").LucideIcon;
        readonly label: "View";
        readonly tone: "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100";
    };
    readonly edit: {
        readonly icon: import("lucide-react").LucideIcon;
        readonly label: "Edit";
        readonly tone: "bg-amber-50 text-amber-800 ring-amber-300 hover:bg-amber-100";
    };
    readonly delete: {
        readonly icon: import("lucide-react").LucideIcon;
        readonly label: "Delete";
        readonly tone: "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100";
    };
};
/**
 * View / Edit / Delete button for a list row: a filled pill with its icon and label. Pass `href` to navigate, else `onClick`.
 * `label` overrides the text (e.g. "Remove"); `title` is the tooltip / accessible name (e.g. "Edit Order #1024").
 * `loading` shows a spinner and blocks clicks while the action runs.
 */
export declare function RowAction({ kind, href, onClick, label, title, disabled, loading, }: {
    kind: keyof typeof ROW_ACTION;
    href?: string;
    onClick?: () => void;
    label?: string;
    title?: string;
    disabled?: boolean;
    loading?: boolean;
}): import("react").JSX.Element;
export declare function EmptyRow({ colSpan, children }: {
    colSpan: number;
    children?: ReactNode;
}): import("react").JSX.Element;
export declare function LoadingRow({ colSpan, text }: {
    colSpan: number;
    text?: ReactNode;
}): import("react").JSX.Element;
/**
 * Loading indicator. `page` = a whole page (or the app) is loading: it sits in the exact centre of the screen,
 * whatever scrolls or sits around it. Without it, it fills the spot it is placed in (a card, a table cell).
 */
/**
 * The common loading icon: an "∞" loop with a stroke running round it, turning in 90° steps
 * for as long as something loads (styles in styles/index.css). Green by default; `tone="current"` takes the text
 * colour instead, for use on coloured buttons where green would not show.
 */
export declare function InfinityLoader({ className, tone }: {
    className?: string;
    tone?: "brand" | "current";
}): import("react").JSX.Element;
export declare function Spinner({ className, text, page }: {
    className?: string;
    text?: ReactNode;
    page?: boolean;
}): import("react").JSX.Element;
export declare function ErrorBox({ message, onRetry }: {
    message: string;
    onRetry?: () => void;
}): import("react").JSX.Element;
export declare function Pagination({ page, totalPages, total, onPage, }: {
    page: number;
    totalPages: number;
    total: number;
    onPage: (p: number) => void;
}): import("react").JSX.Element;
export declare function Tabs<T extends string>({ tabs, value, onChange, }: {
    tabs: {
        value: T;
        label: ReactNode;
    }[];
    value: T;
    onChange: (v: T) => void;
}): import("react").JSX.Element;
/** Label/value pair for detail pages */
export declare function Info({ label, children }: {
    label: string;
    children: ReactNode;
}): import("react").JSX.Element;
export declare function Modal({ open, onClose, title, children, footer, size, centered, className, scrollBody, sheet, }: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    /** Wider screens: sit in the middle of the screen instead of near the top */
    centered?: boolean;
    /** Extra classes for the dialog box */
    className?: string;
    /** false: a fixed-height dialog whose body doesn't scroll; the content lays out (and scrolls) its own parts, e.g. only a list */
    scrollBody?: boolean;
    /** Phones: a bottom sheet as tall as its content instead of the whole screen (short dialogs, e.g. a confirm) */
    sheet?: boolean;
}): import("react").JSX.Element | null;
export declare function ConfirmProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare const useConfirm: () => (message: string, opts?: {
    danger?: boolean;
    confirmLabel?: string;
}) => Promise<boolean>;
type ToastApi = {
    /** Green: something worked */
    success: (m: string) => void;
    /** Green: same look as success, for plain information */
    info: (m: string) => void;
    /** Red: something failed */
    error: (m: string) => void;
    /** Yellow: worked, but needs attention */
    warn: (m: string) => void;
};
/**
 * Toasts in the top-right corner: green / red / yellow, with a close button and a bar that runs from
 * full to empty over 3 s; the toast closes itself when the time is up (or at once on the close button).
 */
export declare function ToastProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare const useToast: () => ToastApi;
/** Extract a message from an unknown error */
export declare const errMsg: (e: unknown) => string;
export {};
