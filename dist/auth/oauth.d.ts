import { OAuth2Client } from "google-auth-library";
type DesktopKeys = {
    installed: {
        client_id: string;
        client_secret: string;
        redirect_uris?: string[];
    };
};
export declare function loadOAuthKeys(): Promise<DesktopKeys["installed"]>;
export declare function makeOAuthClient(redirectUri: string): Promise<OAuth2Client>;
export {};
