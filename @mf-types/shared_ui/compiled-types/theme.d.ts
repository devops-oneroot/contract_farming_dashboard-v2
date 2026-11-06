import { type AnchorHTMLAttributes, type ComponentType, type ReactNode } from "react";
export type ThemeColors = {
    brand: string;
    neutral: string;
    danger: string;
    success: string;
    warning: string;
    highlight: string;
    info: string;
    accent: string;
    surface: string;
    line: string;
};
export type UITheme = {
    mode?: "light" | "dark";
    /** Only the colours you want to change */
    colors?: Partial<ThemeColors>;
    /** Extra overrides applied only in dark mode */
    darkColors?: Partial<ThemeColors>;
};
/** The common default theme: keep in sync with :root in styles/index.css */
export declare const defaultColors: ThemeColors;
/** The :root CSS for a theme */
export declare function themeCss(theme?: UITheme): string;
export type LinkLike = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
}>;
export declare const useUI: () => {
    Link: LinkLike;
};
/**
 * Wrap the app once. No `theme` → the common default theme.
 * `link`: the router's link component (next/link, react-router's Link); defaults to <a>.
 */
export declare function ThemeProvider({ theme, link, children }: {
    theme?: UITheme;
    link?: LinkLike;
    children: ReactNode;
}): import("react").JSX.Element;
