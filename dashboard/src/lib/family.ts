/**
 * Portraits of the demo family, the same free-licence photos as the landing page
 * (credits in landing/README.md#photo-credits).
 */
const px = (path: string, w = 160) => `https://images.pexels.com/photos/${path}?auto=compress&cs=tinysrgb&w=${w}`;
const us = (id: string, w = 160) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop&crop=faces`;

export const FAMILY = [
  { name: "Ma", src: px("2703082/pexels-photo-2703082.jpeg") },
  { name: "Papa", src: px("38544128/pexels-photo-38544128.jpeg") },
  { name: "Rahul", src: us("photo-1757744705465-ea08b0ddc38a") },
  { name: "Priya", src: px("40407265/pexels-photo-40407265.jpeg") },
  { name: "Aarav", src: px("3494565/pexels-photo-3494565.jpeg") },
  { name: "Mrs Iyer", src: px("38982379/pexels-photo-38982379.jpeg") },
];
