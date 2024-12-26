/** @type {import('./$types').PageLoad} */
export function load({ params }) {
  return {
    nameId: params.nameId
  };
}
