export const summonProjectCreateOptions = (pathname: string) =>
  /^\/[^/]+\/summon\/projects\/?$/.test(pathname)
    ? ({ closeOnCreate: true, data: { cover_image_url: "" } } as const)
    : ({} as const);
