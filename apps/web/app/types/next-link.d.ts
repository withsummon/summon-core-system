declare module "next/link" {
  type Props = Omit<React.ComponentProps<"a">, "href" | "prefetch"> & {
    href: string;
    replace?: boolean;
    prefetch?: boolean | "intent" | "render" | "none" | "viewport";
    scroll?: boolean;
    shallow?: boolean;
  };

  const Link: React.FC<Props>;
  export default Link;
}
