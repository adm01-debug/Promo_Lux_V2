/**
 * Fixtures determinísticos para APIFY_MOCK_MODE=true.
 *
 * Cada fixture reproduz o shape bruto que o actor Apify correspondente
 * devolveria em `/datasets/:id/items`. O normalizador do worker é o mesmo
 * usado no modo real — assim testamos o caminho completo.
 *
 * Cobertura de variações (para reduzir divergência com produção):
 * - profile: business account + creator account (sem publicPhone/publicEmail).
 * - posts: imagem única, vídeo/reel, carousel (sidecar) e post sponsored.
 * - hashtag: top posts com autores distintos e mídias mistas.
 * - comments: raiz + reply (child), com mentions e hashtags no texto.
 */

export type NormalizedInstagramItem = {
  source_type: "profile" | "posts" | "hashtag" | "comments";
  username: string | null;
  fullName: string | null;
  bio: string | null;
  followers: number | null;
  following: number | null;
  posts: number | null;
  verified: boolean | null;
  isPrivate: boolean | null;
  isBusinessAccount: boolean | null;
  profilePicUrl: string | null;

  // Contato (profile + posts quando business account)
  email: string | null;
  phone: string | null;
  website: string | null;

  // Localização/negócio (profile)
  businessCategory: string | null;
  city: string | null;
  country: string | null;

  // Post/reel (posts + hashtag + comments.parent)
  post: {
    id: string;
    shortcode: string;
    url: string;
    caption: string | null;
    likes: number | null;
    commentsCount: number | null;
    views: number | null; // reels
    timestamp: string; // ISO 8601
    isReel: boolean;
    isSponsored: boolean;
    hashtags: string[];
    mentions: string[];
    ownerUsername: string | null;
  } | null;

  // Mídia (posts + hashtag) — carousel expõe childCount + primeira mídia
  media: {
    type: "image" | "video" | "carousel";
    displayUrl: string | null;
    videoUrl: string | null;
    thumbnailUrl: string | null;
    childCount: number | null; // sidecar count (carousel)
    dimensions: { width: number; height: number } | null;
  } | null;

  // Comentário (comments)
  comment: {
    id: string;
    text: string;
    author: string;
    likes: number | null;
    timestamp: string;
    parentCommentId: string | null; // reply chain
    hashtags: string[];
    mentions: string[];
  } | null;
};

export const MOCK_DATASET_FIXTURES: Record<string, unknown[]> = {
  "apify/instagram-profile-scraper": [
    // Business account completo (contato exposto)
    {
      username: "lux.ia",
      fullName: "LUX IA",
      biography: "Automação B2B com IA. Contato: contato@lux.ia +55 11 99999-0000",
      followersCount: 12480,
      followsCount: 312,
      postsCount: 187,
      verified: false,
      private: false,
      isBusinessAccount: true,
      businessCategoryName: "Software",
      publicEmail: "contato@lux.ia",
      publicPhoneNumber: "+5511999990000",
      externalUrl: "https://lux.ia",
      city: "São Paulo",
      countryBlock: "BR",
      profilePicUrl: "https://mock.cdn/lux.jpg",
      profilePicUrlHD: "https://mock.cdn/lux_hd.jpg",
    },
    // Creator sem publicEmail/phone — normalizador deve extrair da bio
    {
      username: "creator.ana",
      fullName: "Ana | Marketing",
      biography: "Criadora de conteúdo · ana@creator.com · falar comigo no site",
      followersCount: 54210,
      followsCount: 1287,
      postsCount: 942,
      verified: true,
      private: false,
      isBusinessAccount: false,
      businessCategoryName: null,
      publicEmail: null,
      publicPhoneNumber: null,
      externalUrl: "https://linktr.ee/ana",
      city: null,
      countryBlock: null,
      profilePicUrl: "https://mock.cdn/ana.jpg",
    },
  ],

  "apify/instagram-post-scraper": [
    // Imagem única
    {
      id: "3200000000000000001",
      shortCode: "C_mock_post_1",
      url: "https://www.instagram.com/p/C_mock_post_1/",
      caption: "Novo lançamento da plataforma! #saas #b2b @lux.ia",
      likesCount: 842,
      commentsCount: 37,
      videoViewCount: null,
      timestamp: "2026-07-20T13:00:00.000Z",
      ownerUsername: "lux.ia",
      ownerFullName: "LUX IA",
      type: "Image",
      productType: null,
      isSponsored: false,
      displayUrl: "https://mock.cdn/post1.jpg",
      videoUrl: null,
      dimensionsWidth: 1080,
      dimensionsHeight: 1080,
      hashtags: ["saas", "b2b"],
      mentions: ["lux.ia"],
      childPosts: [],
    },
    // Reel (vídeo)
    {
      id: "3200000000000000002",
      shortCode: "C_mock_reel_1",
      url: "https://www.instagram.com/reel/C_mock_reel_1/",
      caption: "Bastidores do time 🚀 #startup",
      likesCount: 2140,
      commentsCount: 88,
      videoViewCount: 18400,
      videoPlayCount: 22100,
      timestamp: "2026-07-21T18:30:00.000Z",
      ownerUsername: "lux.ia",
      ownerFullName: "LUX IA",
      type: "Video",
      productType: "clips",
      isSponsored: false,
      displayUrl: "https://mock.cdn/reel1.jpg",
      videoUrl: "https://mock.cdn/reel1.mp4",
      dimensionsWidth: 1080,
      dimensionsHeight: 1920,
      hashtags: ["startup"],
      mentions: [],
      childPosts: [],
    },
    // Carousel (sidecar) com 4 slides mistos
    {
      id: "3200000000000000003",
      shortCode: "C_mock_carousel_1",
      url: "https://www.instagram.com/p/C_mock_carousel_1/",
      caption: "Cases da semana — swipe →",
      likesCount: 1580,
      commentsCount: 52,
      videoViewCount: null,
      timestamp: "2026-07-22T09:00:00.000Z",
      ownerUsername: "lux.ia",
      ownerFullName: "LUX IA",
      type: "Sidecar",
      productType: null,
      isSponsored: false,
      displayUrl: "https://mock.cdn/carousel1_cover.jpg",
      videoUrl: null,
      dimensionsWidth: 1080,
      dimensionsHeight: 1350,
      hashtags: [],
      mentions: [],
      childPosts: [
        { id: "c1", type: "Image", displayUrl: "https://mock.cdn/carousel1_1.jpg" },
        { id: "c2", type: "Image", displayUrl: "https://mock.cdn/carousel1_2.jpg" },
        { id: "c3", type: "Video", displayUrl: "https://mock.cdn/carousel1_3.jpg", videoUrl: "https://mock.cdn/carousel1_3.mp4" },
        { id: "c4", type: "Image", displayUrl: "https://mock.cdn/carousel1_4.jpg" },
      ],
    },
    // Post patrocinado (paid partnership)
    {
      id: "3200000000000000004",
      shortCode: "C_mock_sponsored_1",
      url: "https://www.instagram.com/p/C_mock_sponsored_1/",
      caption: "Parceria com @cliente.ads · #ad",
      likesCount: 320,
      commentsCount: 11,
      videoViewCount: null,
      timestamp: "2026-07-22T15:45:00.000Z",
      ownerUsername: "lux.ia",
      ownerFullName: "LUX IA",
      type: "Image",
      productType: null,
      isSponsored: true,
      displayUrl: "https://mock.cdn/sponsored1.jpg",
      videoUrl: null,
      dimensionsWidth: 1080,
      dimensionsHeight: 1080,
      hashtags: ["ad"],
      mentions: ["cliente.ads"],
      childPosts: [],
    },
  ],

  "apify/instagram-hashtag-scraper": [
    // Top post imagem
    {
      id: "3200000000000000101",
      shortCode: "C_mock_htag_1",
      url: "https://www.instagram.com/p/C_mock_htag_1/",
      hashtag: "marketing",
      caption: "Dica de marketing digital de hoje #marketing #growth",
      likesCount: 512,
      commentsCount: 12,
      timestamp: "2026-07-22T10:00:00.000Z",
      ownerUsername: "marketing.pro",
      ownerFullName: "Marketing Pro",
      type: "Image",
      isSponsored: false,
      displayUrl: "https://mock.cdn/htag1.jpg",
      dimensionsWidth: 1080,
      dimensionsHeight: 1080,
      hashtags: ["marketing", "growth"],
      mentions: [],
    },
    // Top post reel
    {
      id: "3200000000000000102",
      shortCode: "C_mock_htag_reel_1",
      url: "https://www.instagram.com/reel/C_mock_htag_reel_1/",
      hashtag: "marketing",
      caption: "3 táticas que dobram o CTR",
      likesCount: 8720,
      commentsCount: 240,
      videoViewCount: 96000,
      timestamp: "2026-07-22T11:00:00.000Z",
      ownerUsername: "growth.hub",
      ownerFullName: "Growth Hub",
      type: "Video",
      productType: "clips",
      isSponsored: false,
      displayUrl: "https://mock.cdn/htag_reel1.jpg",
      videoUrl: "https://mock.cdn/htag_reel1.mp4",
      dimensionsWidth: 1080,
      dimensionsHeight: 1920,
      hashtags: [],
      mentions: [],
    },
    // Top post carousel
    {
      id: "3200000000000000103",
      shortCode: "C_mock_htag_carousel_1",
      url: "https://www.instagram.com/p/C_mock_htag_carousel_1/",
      hashtag: "marketing",
      caption: "Guia completo de funil — swipe",
      likesCount: 3140,
      commentsCount: 91,
      timestamp: "2026-07-22T12:30:00.000Z",
      ownerUsername: "b2b.insights",
      ownerFullName: "B2B Insights",
      type: "Sidecar",
      isSponsored: false,
      displayUrl: "https://mock.cdn/htag_carousel1.jpg",
      dimensionsWidth: 1080,
      dimensionsHeight: 1350,
      hashtags: [],
      mentions: [],
      childPosts: [
        { id: "hc1", type: "Image", displayUrl: "https://mock.cdn/htag_c1.jpg" },
        { id: "hc2", type: "Image", displayUrl: "https://mock.cdn/htag_c2.jpg" },
      ],
    },
  ],

  "apify/instagram-comment-scraper": [
    // Root comment com mention
    {
      id: "17900000000000001",
      text: "Excelente conteúdo! @lux.ia curti demais",
      ownerUsername: "cliente.b2b",
      ownerFullName: "Cliente B2B",
      likesCount: 4,
      timestamp: "2026-07-22T11:15:00.000Z",
      postUrl: "https://www.instagram.com/p/C_mock_post_1/",
      parentCommentId: null,
      hashtags: [],
      mentions: ["lux.ia"],
    },
    // Root comment com hashtag e lead intent
    {
      id: "17900000000000002",
      text: "Quero saber mais, chama no direct #interessado",
      ownerUsername: "lead.quente",
      ownerFullName: "Lead Quente",
      likesCount: 1,
      timestamp: "2026-07-22T11:20:00.000Z",
      postUrl: "https://www.instagram.com/p/C_mock_post_1/",
      parentCommentId: null,
      hashtags: ["interessado"],
      mentions: [],
    },
    // Reply (child) — parentCommentId aponta para o primeiro
    {
      id: "17900000000000003",
      text: "@cliente.b2b obrigado! te chamamos já",
      ownerUsername: "lux.ia",
      ownerFullName: "LUX IA",
      likesCount: 8,
      timestamp: "2026-07-22T11:35:00.000Z",
      postUrl: "https://www.instagram.com/p/C_mock_post_1/",
      parentCommentId: "17900000000000001",
      hashtags: [],
      mentions: ["cliente.b2b"],
    },
  ],
};
