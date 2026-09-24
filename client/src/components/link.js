/** Dùng chung cho các thẻ có link: linkAs={Link} (react-router) → `to`, không có → thẻ <a href>. */
export const getLink = (linkAs, href = '#') => [linkAs || 'a', linkAs ? { to: href } : { href }];
