export const CATALOG = {
  snacks: [
    { id: 's1', name: 'Granola Bars',       desc: 'Assorted flavors, grab-and-go',         sizes: null },
    { id: 's2', name: 'Protein Bars',        desc: 'High protein, 200 cal each',             sizes: null },
    { id: 's3', name: 'Oatmeal Cups',        desc: 'Just add hot water, 3 flavors',          sizes: null },
    { id: 's4', name: 'Fruit Snack Packs',   desc: 'No added sugar, kid-friendly',           sizes: null },
    { id: 's5', name: 'Yogurt Cups',         desc: 'Chobani, refrigerated, 6 flavors',       sizes: null },
  ],
  essentials: [
    { id: 'e1', name: 'Deodorant',              desc: 'Unscented, 2.6 oz stick',              sizes: null },
    { id: 'e2', name: 'Shampoo + Conditioner',  desc: 'Daily use formula, 8 oz',              sizes: null },
    { id: 'e3', name: 'Body Wash',              desc: 'Gentle, fragrance-free, 12 oz',        sizes: null },
    { id: 'e4', name: 'Full Hygiene Kit',       desc: 'Deodorant, soap, dental, hair care',   sizes: null },
    { id: 'e5', name: 'Menstrual Supplies',     desc: 'Pads + tampons, assorted sizes',       sizes: null },
    { id: 'e6', name: 'Toothbrush + Paste',     desc: 'Soft bristle set, travel-friendly',    sizes: null },
  ],
  health: [
    { id: 'h1', name: 'First Aid Kit',       desc: 'Bandages, antiseptic, gauze',   sizes: null },
    { id: 'h2', name: 'Water Bottle',        desc: 'Reusable, 24 oz, BPA-free',     sizes: null },
    { id: 'h3', name: 'Lice Treatment Kit',  desc: 'Complete treatment + comb',     sizes: null },
    { id: 'h4', name: 'Wellness Supplies',   desc: 'Regional and seasonal items',   sizes: null },
  ],
  clothing: [
    { id: 'c1', name: 'T-Shirt',    desc: 'Unisex crew neck, 100% cotton',   sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Top 3 colour preferences? (e.g. blue, black, grey)' },
    { id: 'c2', name: 'Sweatshirt', desc: 'Pullover hoodie, fleece-lined',    sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Top 3 colour preferences? (e.g. navy, green, white)' },
    { id: 'c3', name: 'Leggings',   desc: 'Mid-rise, full length, stretchy',  sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Colour preferences?' },
    { id: 'c4', name: 'Sport Bra',  desc: 'Medium support, breathable',       sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Colour preferences?' },
    { id: 'c5', name: 'Socks 3-Pack', desc: 'Ankle length, mixed colors',     sizes: ['S/M','L/XL'],           notePlaceholder: 'Colour or style preferences?' },
    { id: 'c6', name: 'Underwear',  desc: 'Cotton basics, assorted styles',   sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Style preferences?' },
    { id: 'c7', name: 'Pajama Set', desc: 'Comfort fit, breathable cotton',   sizes: ['XS','S','M','L','XL'],  notePlaceholder: 'Colour preferences?' },
  ],
  supplies: [
    { id: 'p1', name: 'Notebook',         desc: 'College ruled, 100 pages',              sizes: null },
    { id: 'p2', name: 'Folder 3-Pack',    desc: 'Poly pocket folders, assorted',         sizes: null },
    { id: 'p3', name: 'Pen + Pencil Set', desc: 'Blue/black pens + #2 pencils',          sizes: null },
    { id: 'p4', name: 'Full Supply Kit',  desc: 'Notebook, folders, pens, pencils',      sizes: null },
    { id: 'p5', name: 'Backpack',         desc: 'Durable 20L, multiple colors',          sizes: null, notePlaceholder: 'Colour preference? (e.g. black, blue, red)' },
  ],
}

// No emoji — use clean text labels only
export const CATEGORIES = [
  { key: 'snacks',     label: 'Snacks',     color: '#FF9E1B' },
  { key: 'essentials', label: 'Essentials', color: '#32BCAD' },
  { key: 'health',     label: 'Health',     color: '#D0006F' },
  { key: 'clothing',   label: 'Clothing',   color: '#642F6C' },
  { key: 'supplies',   label: 'Supplies',   color: '#003865' },
]

export const SCHOOLS = [
  { id: 'east-high',        name: 'East High School',        city: 'Salt Lake City, UT' },
  { id: 'bayside',          name: 'Bayside High School',      city: 'Pacific Palisades, CA' },
  { id: 'william-mckinley', name: 'William McKinley High',    city: 'Lima, OH' },
  { id: 'west-beverly',     name: 'West Beverly High',        city: 'Beverly Hills, CA' },
  { id: 'shermer',          name: 'Shermer High School',      city: 'Shermer, IL' },
  { id: 'hawkins',          name: 'Hawkins High School',      city: 'Hawkins, IN' },
  { id: 'liberty',          name: 'Liberty High School',      city: 'Evergreen, WA' },
  { id: 'sunnydale',        name: 'Sunnydale High School',    city: 'Sunnydale, CA' },
]

export function generateOrderId() {
  return Math.floor(1000 + Math.random() * 9000)
}
