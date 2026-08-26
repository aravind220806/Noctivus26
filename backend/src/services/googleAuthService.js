export async function verifyGoogleCredential(credential) {
  const params = new URLSearchParams({ id_token: credential });
  const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?${params.toString()}`);
  const profile = await googleResponse.json().catch(() => ({}));
  if (!googleResponse.ok) throw Object.assign(new Error(profile.error_description || 'Google sign-in verification failed.'), { statusCode: 401 });
  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) throw Object.assign(new Error('Google credential audience does not match this app.'), { statusCode: 401 });
  return profile;
}
