import EMPTY_EMAIL_MESSAGE from '../../getConfiguration/sample/empty-email-message';

import { EditorConfigurationSchema, TEditorConfiguration } from './core';

const LOCAL_TEMPLATE_API_URL = import.meta.env.VITE_TEMPLATE_API_URL;
const EXTERNAL_AUTH_REQUEST = 'THERMAL_EDITOR_AUTH_REQUEST';
const EXTERNAL_AUTH_RESPONSE = 'THERMAL_EDITOR_AUTH_RESPONSE';
const EXTERNAL_AUTH_RESPONSE_LEGACY = 'EMAIL_EDITOR_AUTH_RESPONSE';
const EXTERNAL_AUTH_TIMEOUT_MS = 10_000;

type TFetchResponse = TEditorConfiguration | { document: TEditorConfiguration };
type TEditorMode = 'edit' | 'view';
type TEasyGoTemplateRecord = {
    id?: number | string;
    blocks?: unknown;
    template_code?: unknown;
};
type TEasyGoTemplateResponse = {
    result?: TEasyGoTemplateRecord[];
    blocks?: unknown;
    template_code?: unknown;
};
type TUploadSignedUrlResponse = {
    uploadUrl?: string;
    publicUrl?: string;
    url?: string;
    fileUrl?: string;
    key?: string;
    result?: {
        uploadUrl?: string;
        publicUrl?: string;
        url?: string;
        fileUrl?: string;
        key?: string;
    };
};

type TExternalTemplateContext = {
    templateId: string;
    openerOrigin: string | null;
    mode: TEditorMode;
};

type TExternalAuth = {
    token: string;
    apiBaseUrl: string;
};

type TExternalCache = {
    auth?: TExternalAuth;
    document?: TEditorConfiguration;
};

class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

let externalAuthState: TExternalAuth | null = null;

function normalizeDocument(payload: TFetchResponse) {
    if ('document' in payload) {
        return payload.document;
    }
    return payload;
}

function parseJsonLikeValue(raw: unknown): unknown {
    if (!raw) {
        return undefined;
    }
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return undefined;
        }
    }
    return raw;
}

function resolveBlocksPayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }

    const easyGoPayload = payload as TEasyGoTemplateResponse;
    const firstResult = easyGoPayload.result?.[0];

    const resultBlocks = parseJsonLikeValue(firstResult?.blocks);
    if (resultBlocks) {
        return resultBlocks;
    }

    const resultTemplateCode = parseJsonLikeValue(firstResult?.template_code);
    if (resultTemplateCode) {
        return resultTemplateCode;
    }

    const rootBlocks = parseJsonLikeValue(easyGoPayload.blocks);
    if (rootBlocks) {
        return rootBlocks;
    }

    const rootTemplateCode = parseJsonLikeValue(easyGoPayload.template_code);
    if (rootTemplateCode) {
        return rootTemplateCode;
    }

    return undefined;
}

function parseTemplateDocument(payload: unknown) {
    const blocksPayload = resolveBlocksPayload(payload);
    if (blocksPayload) {
        return EditorConfigurationSchema.parse(blocksPayload);
    }
    return EditorConfigurationSchema.parse(payload);
}

function assertLocalApiUrl() {
    if (!LOCAL_TEMPLATE_API_URL) {
        throw new Error('Missing VITE_TEMPLATE_API_URL in environment variables.');
    }
    return LOCAL_TEMPLATE_API_URL;
}

function pickUploadResponsePayload(payload: TUploadSignedUrlResponse) {
    return payload.result ?? payload;
}

function ensureTrailingSlash(url: string) {
    return url.endsWith('/') ? url : `${url}/`;
}

function resolveApiBaseFromTemplateApiUrl(url: string) {
    const templatePathMarker = '/events/tickets/template';
    const markerIndex = url.indexOf(templatePathMarker);
    if (markerIndex >= 0) {
        return ensureTrailingSlash(url.slice(0, markerIndex));
    }
    return ensureTrailingSlash(url);
}

function readTemplateIdFromSearchParams() {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get('templateId');
    if (!templateId) {
        return null;
    }
    return templateId;
}

function decodeBase64Param(value: string | null) {
    if (!value) {
        return null;
    }
    try {
        return window.atob(value);
    } catch {
        return value;
    }
}

function readExternalTemplateContext(): TExternalTemplateContext | null {
    const params = new URLSearchParams(window.location.search);
    const templateId = decodeBase64Param(params.get('templateId'));
    const openerOrigin = decodeBase64Param(params.get('openerOrigin'));
    const modeParam = params.get('mode');

    if (!templateId || !openerOrigin) {
        return null;
    }

    const mode: TEditorMode = modeParam === 'view' ? 'view' : 'edit';
    return { templateId, openerOrigin, mode };
}

function externalCacheKey(templateId: string) {
    return `external_auth_${templateId}`;
}

function readExternalCache(templateId: string) {
    const value = sessionStorage.getItem(externalCacheKey(templateId));
    if (!value) {
        return null;
    }
    try {
        return JSON.parse(value) as TExternalCache;
    } catch {
        return null;
    }
}

function writeExternalCache(templateId: string, cache: TExternalCache) {
    sessionStorage.setItem(externalCacheKey(templateId), JSON.stringify(cache));
}

async function requestExternalAuth(context: TExternalTemplateContext) {
    if (!window.opener) {
        throw new Error('No opener window found for external auth.');
    }

    return await new Promise<TExternalAuth>((resolve, reject) => {
        let timeoutId: number | null = window.setTimeout(() => {
            window.removeEventListener('message', handleMessage);
            reject(new Error('Timed out while waiting for external auth response.'));
        }, EXTERNAL_AUTH_TIMEOUT_MS);

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== window.opener) {
                return;
            }

            if (context.openerOrigin && event.origin !== context.openerOrigin) {
                return;
            }

            const data = event.data as { type?: string; token?: string; apiBaseUrl?: string; apiBase?: string };
            const apiBaseUrl = data.apiBaseUrl ?? data.apiBase;
            const isSupportedResponseType =
                data?.type === EXTERNAL_AUTH_RESPONSE || data?.type === EXTERNAL_AUTH_RESPONSE_LEGACY;
            if (!isSupportedResponseType || !data.token || !apiBaseUrl) {
                return;
            }

            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
                timeoutId = null;
            }
            window.removeEventListener('message', handleMessage);
            resolve({ token: data.token, apiBaseUrl });
        };

        window.addEventListener('message', handleMessage);
        window.opener.postMessage(
            {
                type: EXTERNAL_AUTH_REQUEST,
                templateId: context.templateId,
            },
            context.openerOrigin ?? '*'
        );
    });
}

async function fetchExternalTemplate(templateId: string, auth: TExternalAuth) {
    const response = await fetch(`${auth.apiBaseUrl.replace(/\/$/, '')}/events/tickets/template/${templateId}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${auth.token}`,
        },
    });

    if (!response.ok) {
        throw new HttpError(response.status, `External template fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as TEasyGoTemplateResponse | TFetchResponse;
    if (typeof payload === 'object' && payload !== null && 'document' in payload) {
        return parseTemplateDocument(normalizeDocument(payload));
    }
    return parseTemplateDocument(payload);
}

async function updateExternalTemplate(
    templateId: string,
    auth: TExternalAuth,
    document: TEditorConfiguration,
    html: string
) {
    const response = await fetch(`${auth.apiBaseUrl.replace(/\/$/, '')}/events/tickets/template/update/${templateId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
            blocks: document,
            template_code: document,
            html,
        }),
    });

    if (!response.ok) {
        throw new HttpError(response.status, `External template save failed with status ${response.status}`);
    }
}

async function fetchLocalTemplate() {
    const url = assertLocalApiUrl();
    const templateId = readTemplateIdFromSearchParams();
    const resolvedUrl = templateId ? `${url}?templateId=${encodeURIComponent(templateId)}` : url;

    const response = await fetch(resolvedUrl, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new HttpError(response.status, `Template fetch failed with status ${response.status}`);
    }

    const payload = (await response.json()) as TEasyGoTemplateResponse | TFetchResponse;
    if (typeof payload === 'object' && payload !== null && 'document' in payload) {
        return parseTemplateDocument(normalizeDocument(payload));
    }
    return parseTemplateDocument(payload);
}

async function saveLocalTemplate(document: TEditorConfiguration, html: string) {
    const url = assertLocalApiUrl();
    const templateId = readTemplateIdFromSearchParams();
    const resolvedUrl = templateId ? `${url}?templateId=${encodeURIComponent(templateId)}` : url;

    const response = await fetch(resolvedUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({
            blocks: document,
            template_code: document,
            html,
        }),
    });

    if (!response.ok) {
        throw new HttpError(response.status, `Template save failed with status ${response.status}`);
    }
}

async function ensureExternalAuth(context: TExternalTemplateContext) {
    if (!externalAuthState) {
        externalAuthState = await requestExternalAuth(context);
    }
    return externalAuthState;
}

export function isExternalMode() {
    return readExternalTemplateContext() !== null;
}

export function canEditCurrentTemplate() {
    const context = readExternalTemplateContext();
    if (!context) {
        return true;
    }
    return context.mode !== 'view';
}

export async function loadInitialTemplate() {
    const context = readExternalTemplateContext();
    if (!context) {
        return await fetchLocalTemplate();
    }

    const cached = readExternalCache(context.templateId);
    if (cached?.auth) {
        externalAuthState = cached.auth;
    }

    const fallbackDocument = cached?.document ?? EMPTY_EMAIL_MESSAGE;

    try {
        const freshAuth = await requestExternalAuth(context);
        externalAuthState = freshAuth;

        const freshDocument = await fetchExternalTemplate(context.templateId, freshAuth);
        writeExternalCache(context.templateId, {
            auth: freshAuth,
            document: freshDocument,
        });
        return freshDocument;
    } catch {
        if (cached?.document) {
            return cached.document;
        }
        return fallbackDocument;
    }
}

export async function saveCurrentTemplate(document: TEditorConfiguration, html: string) {
    const context = readExternalTemplateContext();
    if (!context) {
        return await saveLocalTemplate(document, html);
    }

    if (context.mode === 'view') {
        throw new Error('Template is read-only in view mode.');
    }

    if (!externalAuthState) {
        externalAuthState = await requestExternalAuth(context);
    }

    try {
        await updateExternalTemplate(context.templateId, externalAuthState, document, html);
    } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 401) {
            throw error;
        }
        const refreshedAuth = await requestExternalAuth(context);
        externalAuthState = refreshedAuth;
        await updateExternalTemplate(context.templateId, refreshedAuth, document, html);
    }

    writeExternalCache(context.templateId, {
        auth: externalAuthState,
        document,
    });
}

export async function uploadImageFile(file: File) {
    const context = readExternalTemplateContext();
    let signedUrlEndpoint = '';
    let authToken: string | null = null;

    if (context) {
        const auth = await ensureExternalAuth(context);
        signedUrlEndpoint = `${ensureTrailingSlash(auth.apiBaseUrl)}events/tickets/template/upload/presign`;
        authToken = auth.token;
    } else {
        signedUrlEndpoint = `${resolveApiBaseFromTemplateApiUrl(assertLocalApiUrl())}events/tickets/template/upload/presign`;
    }

    const signedUrlResponse = await fetch(signedUrlEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
        }),
    });

    if (!signedUrlResponse.ok) {
        throw new Error(`Signed URL generation failed with status ${signedUrlResponse.status}`);
    }

    const signedUrlPayload = (await signedUrlResponse.json()) as TUploadSignedUrlResponse;
    const signedUrlData = pickUploadResponsePayload(signedUrlPayload);
    const uploadUrl = signedUrlData.uploadUrl;
    const publicUrl = signedUrlData.publicUrl ?? signedUrlData.url ?? signedUrlData.fileUrl;

    if (!uploadUrl || !publicUrl) {
        throw new Error('Signed URL response is missing uploadUrl or publicUrl');
    }

    const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
    });

    if (!uploadResponse.ok) {
        throw new Error(`File upload failed with status ${uploadResponse.status}`);
    }

    return publicUrl;
}
