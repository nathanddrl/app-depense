// Fallback du slot implicite `children` en hard navigation (Next 16, parallel
// routes) : sans lui, un refresh sur une URL interceptée renverrait un 404.
export default function Default() {
  return null;
}
