import { NextSeo } from "next-seo";
import { useRouter } from "next/router";

type Props = {
  title?: string;
  description?: string;
};

const Seo = ({ title, description }: Props) => {
  const router = useRouter();

  const defaultTitle = `Quiz Aide`;
  const defaultDescription = `Create quizzes with the help of AI`;
  const baseUrl = `https://quizaide.leeto.dev`;

  return (
    <NextSeo
      title={
        router.asPath === "/"
          ? defaultTitle
          : `${title || defaultTitle} | Quiz Aide`
      }
      description={description || defaultDescription}
      canonical={`${baseUrl}${router.asPath}`}
      openGraph={{
        url: `${baseUrl}${router.asPath}`,
        title: defaultTitle,
        description: description || defaultDescription,
        images: [
          {
            url: "/robotbook2.png",
            width: 600,
            height: 600,
            alt: "Quiz Aide",
            type: "image/png",
          },
          { url: "/robotbook2.png" },
        ],
        siteName: "Quiz Aide",
      }}
      twitter={{
        handle: "@leetosc",
        site: "https://quizaide.leeto.dev",
        cardType: "summary_large_image",
      }}
      additionalLinkTags={[
        {
          rel: "icon",
          href: "/favicon.ico",
        },
      ]}
    />
  );
};

export default Seo;
