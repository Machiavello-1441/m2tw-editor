import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CONNECTOR_ID = '6a44eaca88b0c5609fcdc001';

// Hard cap on the base64 payload (100 MB of base64 ≈ 75 MB of binary), so a
// single request can never allocate an unbounded amount of memory.
const MAX_BASE64_CHARS = 100 * 1024 * 1024;
const MAX_REQUEST_CHARS = MAX_BASE64_CHARS + 1024 * 1024; // + room for the JSON envelope

// This endpoint only stores the map-layer bundle, so only zip archives are
// accepted, and each user gets a fixed number of uploads per day.
const ALLOWED_MIME = 'application/zip';
const MAX_UPLOADS_PER_DAY = 10;

function safeFileName(name: string): string {
  const base = String(name).split(/[\\/]/).pop()!.replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return base.toLowerCase().endsWith('.zip') ? base : `${base || 'export'}.zip`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Reject an oversized request before reading/parsing its body.
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_REQUEST_CHARS) {
      return Response.json({ error: 'Payload too large: maximum file size is 75 MB' }, { status: 413 });
    }

    const body = await req.json();
    const { fileName, fileBase64, mimeType = ALLOWED_MIME } = body;

    if (!fileName || !fileBase64) {
      return Response.json({ error: 'fileName and fileBase64 are required' }, { status: 400 });
    }

    if (mimeType !== ALLOWED_MIME) {
      return Response.json({ error: 'Only zip archives can be uploaded' }, { status: 415 });
    }

    // Validate the size before decoding, so atob never allocates unbounded memory.
    if (typeof fileBase64 !== 'string' || fileBase64.length > MAX_BASE64_CHARS) {
      return Response.json({ error: 'File too large: maximum file size is 75 MB' }, { status: 413 });
    }

    // Per-user quota: the upload runs on the caller's own Drive connection, and
    // each user may store a bounded number of bundles per day.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentUploads = await base44.entities.DriveUpload.filter(
      { created_by_id: user.id, created_date: { $gte: since } },
      { limit: MAX_UPLOADS_PER_DAY },
    );
    if ((recentUploads?.items?.length ?? 0) >= MAX_UPLOADS_PER_DAY) {
      return Response.json({ error: `Daily upload limit reached (${MAX_UPLOADS_PER_DAY} uploads per 24 h)` }, { status: 429 });
    }

    // Token of this caller's own Drive connection — never a shared app token.
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);

    const safeName = safeFileName(fileName);

    // Decode base64 to binary
    const binaryStr = atob(fileBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    // Multipart upload to Google Drive
    const boundary = 'boundary_m2tw_export';
    const metadata = JSON.stringify({ name: safeName, mimeType });
    const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
    const dataPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const endPart = `\r\n--${boundary}--`;

    const metaBytes = new TextEncoder().encode(metaPart);
    const dataHeaderBytes = new TextEncoder().encode(dataPart);
    const endBytes = new TextEncoder().encode(endPart);

    const body2 = new Uint8Array(metaBytes.length + dataHeaderBytes.length + bytes.length + endBytes.length);
    body2.set(metaBytes, 0);
    body2.set(dataHeaderBytes, metaBytes.length);
    body2.set(bytes, metaBytes.length + dataHeaderBytes.length);
    body2.set(endBytes, metaBytes.length + dataHeaderBytes.length + bytes.length);

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body2,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return Response.json({ error: `Drive upload failed: ${err}` }, { status: 500 });
    }

    const file = await uploadRes.json();
    await base44.entities.DriveUpload.create({ file_name: safeName, size_bytes: bytes.length });
    return Response.json({ fileId: file.id, fileName: file.name, webViewLink: file.webViewLink });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});