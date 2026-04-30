export declare function getCookieOptions(): Promise<{
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    sameSite: "lax";
}>;
