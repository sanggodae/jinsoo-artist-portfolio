import { BoardPost } from '../types';

/**
 * Initial curated artist logs & exhibition journal for PARK JIN SOO.
 * Used as seed/fallback to display a rich studio blog experience.
 */
export const DEFAULT_BOARD_POSTS: BoardPost[] = [
  {
    id: 'post-init-1',
    title: "새로운 연작 '헤테로토피아 2026' 캔버스 마티에르 제작 과정",
    content: `2026년 봄, 새로운 캔버스를 펼치며 작업을 시작한다.

나의 작업에서 마티에르는 단순한 기법이 아니라 시간의 층위를 쌓아 올리는 신체적 행위다. 캔버스 위에 호소와 석고, 아크릴 미디엄을 배합하여 표면의 요철을 만들고, 그 위에 안료를 스며들게 하는 과정은 존재와 부재 사이의 경계를 탐색하는 일이다.

이번 연작에서는 푸른색과 흑색의 미묘한 번짐을 통해 관객이 현실의 번잡함을 잊고 내면의 '제3의 공간'으로 침잠할 수 있는 고요한 화면을 구축하고자 한다.

작업실 창밖으로 비치는 햇살과 캔버스 위에서 마르는 안료의 호흡을 느끼며, 다시 붓을 든다.`,
    coverImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    ],
    videoUrls: [],
    createdAt: '2026-03-15T10:00:00.000Z',
    updatedAt: '2026-03-15T10:00:00.000Z',
    status: 'published',
    authorName: 'PARK JIN SOO',
    isAdminPost: true,
  },
  {
    id: 'post-init-2',
    title: '국립현대미술관 동시대 회화 특별전 관람 및 사유의 기록',
    content: `오랜만에 국립현대미술관을 찾아 한국 현대회화의 물질성과 공간성에 관한 특별전을 관람했다.

물감의 두께감과 붓질의 궤적이 만들어내는 시각적 긴장은 언제나 나에게 깊은 자극을 준다. 특히 평면 회화가 어떻게 공간과 호흡하고 관객과의 거리를 좁혀나가는가에 대한 다양한 작가들의 치열한 고민을 엿볼 수 있었다.

미술관을 나서며 나의 작업에서 '화면이 획득해야 할 침묵의 무게'에 대해 다시금 생각해보게 되었다. 물질을 다루되 물질에 매몰되지 않고, 정신성을 잃지 않는 회화의 가능성을 모색해야겠다.`,
    coverImage: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1572947650440-e8a97ef053b2?auto=format&fit=crop&w=1200&q=80',
    ],
    videoUrls: [],
    createdAt: '2026-02-28T14:30:00.000Z',
    updatedAt: '2026-02-28T14:30:00.000Z',
    status: 'published',
    authorName: 'PARK JIN SOO',
    isAdminPost: true,
  },
  {
    id: 'post-init-3',
    title: '제3의 공간을 향한 색채와 물질성의 탐색 노트',
    content: `선인장의 강인한 생명력과 정형화된 도시 건축물의 대비 속에서 우리는 어떤 위안을 얻을 수 있을까.

화면 안에서 선인장은 역경 속에서도 묵묵히 자리를 지키는 우리의 모습을 대변하고, 직선적인 건축물은 규격화된 삶의 틀을 상징한다. 그리고 그 위를 날아오르는 새의 형상은 현실의 제약을 넘어선 미지의 세계, 즉 이상의 공간을 향한 열망이다.

안료를 긁어내고 다시 덮는 반복적인 노동을 통해 평면은 단순한 지지체를 넘어 하나의 살아있는 유기체로 변모한다.`,
    coverImage: 'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200&q=80',
    imageUrls: [
      'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=1200&q=80',
    ],
    videoUrls: [],
    createdAt: '2026-01-20T09:15:00.000Z',
    updatedAt: '2026-01-20T09:15:00.000Z',
    status: 'published',
    authorName: 'PARK JIN SOO',
    isAdminPost: true,
  },
];
