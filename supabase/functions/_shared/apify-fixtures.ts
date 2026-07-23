/**
 * Fixtures determinísticos para APIFY_MOCK_MODE=true.
 *
 * Cada fixture reproduz o shape bruto que o actor Apify correspondente
 * devolveria em `/datasets/:id/items`. O normalizador do worker é o mesmo
 * usado no modo real — assim testamos o caminho completo.
 */

export type NormalizedInstagramItem = {
  source_type: "profile" | "posts" | "hashtag" | "comments";
  username: string | null;
  fullName: string | null;
  bio: string | null;
  followers: number | null;
  posts: number | null;
  verified: boolean | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  businessCategory: string | null;
  city: string | null;
  country: string | null;
  post: {
    id: string;
    shortcode: string;
    url: string;
    caption: string | null;
    likes: number | null;
    commentsCount: number | null;
    views: number | null;
    timestamp: string;
    isReel: boolean;
  } | null;
  media: {
    type: "image" | "video" | "carousel";
    displayUrl: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
  } | null;
  comment: {
    id: string;
    text: string;
    author: string;
    likes: number | null;
    timestamp: string;
  } | null;
};

export const MOCK_DATASET_FIXTURES: Record<string, unknown[]> = {
  "apify/instagram-profile-scraper": [
    {
      username: "lux.ia",
      fullName: "LUX IA",
      biography: "Automação B2B com IA. Contato: contato@lux.ia +55 11 99999-0000",
      followersCount: 12480,
      followsCount: 312,
      postsCount: 187,
      verified: false,
      isBusinessAccount: true,
      businessCategoryName: "Software",
      publicEmail: "contato@lux.ia",
      publicPhoneNumber: "+5511999990000",
      externalUrl: "https://lux.ia",
      city: "São Paulo",
      countryBlock: "BR",
      profilePicUrl: "https://mock.cdn/lux.jpg",
    },
  ],
  "apify/instagram-post-scraper": [
    {
      id: "3200000000000000001",
      shortCode: "C_mock_post_1",
      url: "https://www.instagram.com/p/C_mock_post_1/",
      caption: "Novo lançamento da plataforma! #saas #b2b",
      likesCount: 842,
      commentsCount: 37,
      videoViewCount: null,
      timestamp: "2026-07-20T13:00:00.000Z",
      ownerUsername: "lux.ia",
      type: "Image",
      displayUrl: "https://mock.cdn/post1.jpg",
      videoUrl: null,
      productType: null,
    },
    {
      id: "3200000000000000002",
      shortCode: "C_mock_reel_1",
      url: "https://www.instagram.com/reel/C_mock_reel_1/",
      caption: "Bastidores do time 🚀",
      likesCount: 2140,
      commentsCount: 88,
      videoViewCount: 18400,
      timestamp: "2026-07-21T18:30:00.000Z",
      ownerUsername: "lux.ia",
      type: "Video",
      displayUrl: "https://mock.cdn/reel1.jpg",
      videoUrl: "https://mock.cdn/reel1.mp4",
      productType: "clips",
    },
  ],
  "apify/instagram-hashtag-scraper": [
    {
      id: "3200000000000000101",
      shortCode: "C_mock_htag_1",
      url: "https://www.instagram.com/p/C_mock_htag_1/",
      hashtag: "marketing",
      caption: "Dica de marketing digital de hoje",
      likesCount: 512,
      commentsCount: 12,
      timestamp: "2026-07-22T10:00:00.000Z",
      ownerUsername: "marketing.pro",
      type: "Image",
      displayUrl: "https://mock.cdn/htag1.jpg",
    },
  ],
  "apify/instagram-comment-scraper": [
    {
      id: "17900000000000001",
      text: "Excelente conteúdo!",
      ownerUsername: "cliente.b2b",
      likesCount: 4,
      timestamp: "2026-07-22T11:15:00.000Z",
      postUrl: "https://www.instagram.com/p/C_mock_post_1/",
    },
    {
      id: "17900000000000002",
      text: "Quero saber mais, chama no direct",
      ownerUsername: "lead.quente",
      likesCount: 1,
      timestamp: "2026-07-22T11:20:00.000Z",
      postUrl: "https://www.instagram.com/p/C_mock_post_1/",
    },
  ],
};
