update public.products
set price = round(price),
    image_url = '',
    image_urls = '[]'::jsonb
where price <> round(price)
   or image_url <> ''
   or image_urls <> '[]'::jsonb;
