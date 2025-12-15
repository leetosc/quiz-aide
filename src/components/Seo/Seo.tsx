import { NextSeo } from "next-seo";
import { useRouter } from "next/router";

type Props = {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
};

const Seo = ({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  noIndex,
}: Props) => {
  const router = useRouter();

  const defaultTitle = `Quiz Aide`;
  const defaultDescription = `Create quizzes with the help of AI`;
  const baseUrl = `https://quizaide.leeto.dev`;

  const finalTitle =
    router.asPath === "/"
      ? defaultTitle
      : `${title || defaultTitle} | Quiz Aide`;

  return (
    <NextSeo
      title={finalTitle}
      description={description || defaultDescription}
      canonical={`${baseUrl}${router.asPath}`}
      noindex={noIndex}
      openGraph={{
        url: `${baseUrl}${router.asPath}`,
        title: ogTitle || title || defaultTitle,
        description: ogDescription || description || defaultDescription,
        images: [
          {
            url: ogImage || `${baseUrl}/robotbook2.png`,
            width: 600,
            height: 600,
            alt: ogTitle || title || "Quiz Aide",
            type: "image/png",
          },
        ],
        siteName: "Quiz Aide",
        type: "website",
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
