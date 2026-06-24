// ============================================================
// K for Kids Books Library — Google Apps Script Backend
// ============================================================
// SETUP:
//   1. Verify SPREADSHEET_ID and IMAGE_FOLDER_IDS below.
//   2. Project Settings > Script Properties > Add property:
//        Key: ADMIN_PASSWORD   Value: (your password)
//   3. Run setupImageNames() ONCE from the editor to populate
//      the "Image Name" column in your Master DB sheet.
//   4. Deploy as Web App (Execute as: Me, Access: Anyone).
// ============================================================

const CONFIG = {
  SPREADSHEET_ID: '1hPnGg26eaRplb-4hQWLyZcJ7pK3hBiJeqfVKdFR9hM0',

  // Tab name in your spreadsheet that holds the book list
  MASTER_SHEET_NAME: 'Master DB',

  // Google Drive folder IDs containing book cover images
  IMAGE_FOLDER_IDS: [
      '1L7w6aq4U7iWKVQ1msjMfuL00wmlY1ouZ'
  ],

  // Customer DB sheet name
  CUSTOMER_SHEET_NAME: 'Customer DB'
};

// Column indices in the Master DB sheet (0-based)
// Original: Sr.No | Language | Book no. | Book name | Issued to | Author | Publication
// New cols added by this script:
const C = {
  SR_NO:       0,
  LANGUAGE:    1,
  BOOK_NO:     2,
  BOOK_NAME:   3,
  ISSUED_TO:   4,
  AUTHOR:      5,
  PUBLICATION: 6,
  STATUS:      7,   // Available / Reserved / Issued
  RESERVED_BY: 8,
  PHONE:       9,
  PICKUP_DATE: 10,
  ISSUE_DATE:  11,
  NOTES:       12,
  IMAGE_NAME:  13   // Relative path to image file, e.g. "Horrid Henry- Revenge.jpg"
};

// Column indices in Customer DB sheet (0-based)
// Header: Sr no | Name | Date of start | Location | Address | Account status | Till date sum
const CUST = {
  SR_NO:         0,
  NAME:          1,
  DATE_START:    2,
  LOCATION:      3,
  ADDRESS:       4,
  STATUS:        5,  // Active / Inactive / Closed
  TILL_DATE_SUM: 6
};

// ─────────────────────────────────────────────────────────────
// IMAGE MAP  —  single lookup used by setupImageNames().
// Keys are either:
//   • book numbers  e.g. "E0039"  → matched exactly
//   • book titles   e.g. "Horrid Henry- Revenge" → matched by normalised title
// Values are "subfolder/filename.jpg" (only the filename part matters for Drive lookup).
// Run setupImageNames() once to write these to your sheet.
// ─────────────────────────────────────────────────────────────
const IMAGE_MAP = {
  "E0039": "When I feel Impatient.jpg",
  "E0040": "When I feel Bored.jpg",
  "E0042": "When I feel Jelous.jpg",
  "E0043": "When I feel Sad.jpg",
  "E0044": "When I feel Afraid.jpg",
  "E0058": "Disney- Belle and the perfect pearl.jpg",
  "E0061": "The bestChristmas ever.jpg",
  "E0063": "JM- All in one piece.jpg",
  "E0064": "JM- Mr. large in charge.jpg",
  "E0065": "JM- Five minutes peace.jpg",
  "E0066": "Gumboot_s chocolaty day.jpg",
  "E0067": "Whatever next.jpg",
  "E0068": "151 Akbar Birbal Stories_.jpg",
  "E0070": "Peppa pig sports day.jpg",
  "E0071": "151 Jungle tales.jpg",
  "E0074": "The lost shoe.jpg",
  "E0075": "Uncle Moon Forgets counting.jpg",
  "E0084": "When I feel greedy.jpg",
  "E0087": "Good night stories.jpg",
  "E0091": "Lions in a flap.jpg",
  "E0095": "Ganesha.jpg",
  "E0102": "The lazy donkey.jpg",
  "E0104": "One snowy nights.jpg",
  "E0105": "Paw patrol- Big city adventures.jpg",
  "E0108": "Grumpy badger_s chrismas.jpg",
  "E0109": "Padddington and the christmas surprise.jpg",
  "E0110": "Peppa_s first sleepover.jpg",
  "E0111": "Happy birthday Peppa.jpg",
  "E0113": "Posie the kitten pink.jpg",
  "E0114": "We love bunk beds.jpg",
  "E0115": "The cat in the hat.jpg",
  "E0119": "Big city kitty.jpg",
  "E0120": "Bright stanley.jpg",
  "E0121": "Little Rex.jpg",
  "E0124": "Jolly polly octopus.jpg",
  "E0125": "Paw patrol Pups save Ryder_s robot.jpg",
  "E0126": "Peppa pig The Tooth fairy.jpg",
  "E0127": "Peter Pebbles.jpg",
  "E0128": "Peppa pigs family computer.jpg",
  "E0129": "Disney- The pearl of wisdon.jpg",
  "E0130": "The station mouse.jpg",
  "E0132": "Paw patrol- Pups save the party.jpg",
  "E0135": "Paw patrol- All star pups.jpg",
  "E0136": "Mog_s bad thing.jpg",
  "E0137": "Scardy mouse.jpg",
  "E0138": "Harry and the bucketful of dinosour.jpg",
  "E0139": "The tallest mouse on the street.jpg",
  "E0140": "The children_s fete.jpg",
  "E0141": "Little Cariboue.jpg",
  "E0142": "Snow bears.jpg",
  "E0143": "Treasure Island.jpg",
  "E0144": "If I ran a dog show.jpg",
  "E0147": "Mr. Pusskins.jpg",
  "E0149": "Peppa pig- George and the noisy baby.jpg",
  "E0165": "Thomas and the train-The snowy special.jpg",
  "E0173": "Captain Wag and the pirate dog.jpg",
  "E0181": "ORT_Mums new hat.jpg",
  "E0185": "Oxford Reading Tree- Looking after gran.jpg",
  "E0193": "Princess evies ponies - winter (2).jpg",
  "E0198": "Mog and bunny.jpg",
  "E0199": "Wallace the fire dog.jpg",
  "E0201": "Oola the Owl who lost her Hoot.jpg",
  "E0213": "Jack and the beak stalk.jpg",
  "E0216": "The golden goose.jpg",
  "E0218": "The town mouse and the country mouse.jpg",
  "E0220": "Meddlesom polly.jpg",
  "E0222": "The wolf and the seven.jpg",
  "E0223": "The three billy goats.jpg",
  "E0225": "Cathy_s present.jpg",
  "E0227": "Two sqirrels.jpg",
  "E0235": "DK readers- spiderman.jpg",
  "E0236": "Charlie and Tess.jpg",
  "E0240": "Harry and the Dinosours first sleepover.jpg",
  "E0242": "Princess Evies Ponies- Ballet pony.jpg",
  "E0243": "Peppa_s fairy tale(1).jpg",
  "E0248": "So cozy.jpg",
  "E0257": "My dad the hero.jpg",
  "E0259": "Peppa meets father christamas.jpg",
  "E0269": "The other goose.jpg",
  "E0270": "Cheeky Monkey - not available.jpg",
  "E0276": "Miss Naughty worries Mr. worry.jpg",
  "E0279": "Miss bossy saves the zoo.jpg",
  "E0280": "Miss Lucky_s friend.jpg",
  "E0281": "Mr. Strong looks for a job.jpg",
  "E0283": "Mr.Nosey and the excellent idea.jpg",
  "E0286": "Mr. Silly gets the giggles.jpg",
  "E0287": "Mr. Happy at sports day.jpg",
  "E0290": "Little red tractor.jpg",
  "E0292": "Miss trouble changes colour.jpg",
  "E0293": "Harry and the dinosour_s say Raahh.jpg",
  "E0295": "Harry and the dinosour_s go wild.jpg",
  "E0312": "SM- Grandpas bag of stories.jpg",
  "E0313": "SM- How I taught my grandmothr to read.jpg",
  "E0316": "SM- The magical drum.jpg",
  "E0318": "DK readers- Fantastic four.jpg",
  "E0320": "DK readers- Avengers assemble.jpg",
  "E0321": "DK readers-X-men.jpg",
  "E0322": "DK readers- Amazing powers.jpg",
  "E0323": "Peppa pig Recycling fun.jpg",
  "E0329": "The Littlest Yak.jpg",
  "E0330": "DK readers-The infinite collection.jpg",
  "E0336": "The treasure hunt.jpg",
  "E0338": "Mr. bump.jpg",
  "E0339": "Mr. Nonsense.jpg",
  "E0341": "Mr. Chatterbox.jpg",
  "E0342": "Miss Somersault.jpg",
  "E0343": "Mr. Bounce.jpg",
  "E0344": "Miss christman.jpg",
  "E0345": "Mr. Busy.jpg",
  "E0347": "Mr. Good.jpg",
  "E0348": "Nelson.jpg",
  "E0349": "Grandads bench.jpg",
  "E0351": "Famous Five- Five go to Mystery moor.jpg",
  "E0353": "All together now (2).jpg",
  "E0368": "The Wizard of Oz.jpg",
  "E0389": "Famous Five- Half term adventure.jpg",
  "E0398": "Harruy and the Dinosours Christmas wish.jpg",
  "E0402": "Elmer and the tune.jpg",
  "E0406": "VT- Do it yourself.jpg",
  "E0408": "Elmer and wilbur.jpg",
  "E0416": "Mog and the fox night.jpg",
  "E0422": "Enid Blyton- Sneezing dog.jpg",
  "E0426": "Secret seven- Puzle for the SS.jpg",
  "E0427": "Enid Blyton- The Ship of advenure.jpg",
  "E0432": "Enid Blyton- The valley of adventure.jpg",
  "E0449": "Oliver Moons christmas cracker.jpg",
  "E0450": "Elmer and the wind.jpg",
  "E0456": "Diary of a Wimpy Kid- Rodrick rules.png",
  "E0460": "Oxford Reading Tree- Kipper and the giant.jpg",
  "E0462": "Tom Gates- Genuis Ideas.jpg",
  "E0463": "Judy Moody saves the world.jpg",
  "E0465": "RD- BFG.jpg",
  "E0466": "RD- Charlie and the great glass elevator.jpg",
  "E0467": "RD- Witches.jpg",
  "E0469": "Tom Gates- Tremendous Tales.jpg",
  "E0477": "Mog_s ABC.jpg",
  "E0478": "Peppa the mermaid.jpg",
  "E0493": "VS- Oh that_s rude.jpg",
  "E0500": "The Tabitha Stories.jpg",
  "E0502": "Little tigers big surprise.jpg",
  "E0505": "DW- Slime.jpg",
  "E0507": "DW- Grandpa_s great escape.jpg",
  "E0508": "DW- Mr. Stink.jpg",
  "E0509": "DW- The boy in the dress.jpg",
  "E0510": "DW- Awefull auntie.jpg",
  "E0512": "AC- Spy Dog.jpg",
  "E0513": "AC- Spy dog 2.jpg",
  "E0514": "DB- AniMalcolm.jpg",
  "E0515": "DB- Head Kid.jpg",
  "E0516": "DB- Taylor Turbochaser.jpg",
  "E0517": "DB- The person controller.jpg",
  "E0526": "Captain Underpants- Book 1.jpg",
  "E0527": "Captain Underpants- Book 2.jpg",
  "E0529": "Captain Underpants- Book 4.jpg",
  "E0530": "Captain Underpants- Book 5.jpg",
  "E0532": "Captain Underpants- Book 7.jpg",
  "E0534": "Captain Underpants- Book 9.jpg",
  "E0535": "Captain Underpants- Book 10.jpg",
  "E0537": "Captain Underpants- Book 12.jpg",
  "E0538": "Enid Blyton- Faraway tree adventure.jpg",
  "E0539": "Enid Blyton- First term Malory towers.jpg",
  "E0540": "Enid Blyton- Goodbye Malory towers.jpg",
  "E0541": "Enid Blyton- Mr. Icy Cold.jpg",
  "E0542": "Enid Blyton- Peter and the magic shadow.jpg",
  "E0543": "Famous Five- A lazy Afteroon.jpg",
  "E0544": "Enid Blyton- Tell a story Book.jpg",
  "E0545": "Enid Blyton- The Amelia Jane collection.jpg",
  "E0546": "Enid Blyton- The cherry tree farm.jpg",
  "E0547": "The Little Brown Bear.jpg",
  "E0548": "Enid Blyton- The Mistory of the invisible ink.jpg",
  "E0549": "Famous Five- George_s hair is too long.jpg",
  "E0551": "Enid Blyton- The wishing chair collection.jpg",
  "E0552": "Enid Blyton- The wishing chair -single story.jpg",
  "E0553": "Famous Five- Well done famous five.jpg",
  "E0554": "Funny stories for 5 years Old.jpg",
  "E0555": "Funny stories for 6 years Old.jpg",
  "E0556": "Funny stories for 7 years Old.jpg",
  "E0932": "Christopher_s Bicycles.jpg",
  "E0933": "Rivalry at Silver Spires.jpg",
  "E0936": "The runaway pancake.jpg",
  "E0938": "Frozen.jpg",
  "E0939": "Frozen 2.jpg",

  // ── Title-keyed entries (matched by normalised book title) ──
  // ── Horrid Henry ──────────────────────────────────────────
  "Horrid Henry- Revenge":            "Horrid Henry- Revenge.jpg",
  "Horrid Henry- Monster movie":      "Horrid Henry- Monster movie.jpg",
  "Horrid Henry- Gets rich quick":    "Horrid Henry- Gets rich quick.jpg",
  "Horrid Henry- Mega mean time machine": "Horrid Henry- Mega mean time machine.jpg",
  "Horrid Henry- Secret Club":        "Horrid Henry- Secret Club.jpg",
  "Horrid Henry- Double Dare":        "Horrid Henry- Double Dare.jpg",
  "Horrid Henry- Nightmare":          "Horrid Henry- Nightmare.jpg",
  "Horrid Henry- Tricks the tooth fairy": "Horrid Henry- Tricks the tooth fairy.jpg",
  "Horrid Henry- Robs the bank":      "Horrid Henry- Robs the bank.jpg",
  "Horrid Henry- Stinkbomb":          "Horrid Henry- Stinkbomb.jpg",
  "Horrid Henry- Meets the queen":    "Horrid Henry- Meets the queen.jpg",
  "Horrid Henry- Mummy_s curse":      "Horrid Henry- Mummy_s curse.jpg",
  "Horrid Henry- Wakes up dead":      "Horrid Henry- Wakes up dead.jpg",
  "Horrid Henry-  Nits":              "Horrid Henry-  Nits.jpg",
  "Horrid Henry- Football Friend":    "Horrid Henry- Football Friend.jpg",
  "Horrid Henry- The Football friend":"Horrid Henry- The Football friend.jpg",
  "Horrid Henry- Haunted House":      "Horrid Henry- Haunted House.jpg",
  "Horrid Henry- Christmas cracker":  "Horrid Henry- Christmas cracker.jpg",
  "Horrid Henry- Abominable snowman": "Horrid Henry- Abominable snowman.jpg",
  "Horrid Henry- Zombie Vampire":     "Horrid Henry- Zombie Vampire.jpg",
  "Horrid Henry- Horrid Joke book":   "Horrid Henry- Horrid Joke book.jpg",
  "Horrid Henry- Bogey Babysitter":   "Horrid Henry- Bogey Babysitter.jpg",
  "Horrid Henry- Joke Book":          "Horrid Henry- Joke Book.jpg",
  "Horrid Henry- Jolly Joke book":    "Horrid Henry- Jolly Joke book.jpg",
  "Horrid Henry- Favourite joke book":"Horrid Henry- Favourite joke book.jpg",

  // ── Holly Webb ────────────────────────────────────────────
  "HW- The forgotten puppy":          "HW- The forgotten puppy.jpg",
  "HW- Ginger thet stray Kitten":     "HW- Ginger thet stray Kitten.jpg",
  "HW- Lost in the snow":             "HW- Lost in the snow.jpg",
  "HW- Sky the unwanted Kitten":      "HW- Sky the unwanted Kitten.jpg",
  "HW- Harry the homeless puppy":     "HW- Harry the homeless puppy.jpg",
  "HW- Buttons the runaway puppy":    "HW- Buttons the runaway puppy.jpg",
  "HW- Lost in the storm":            "HW- Lost in the storm.jpg",
  "HW- The unwanted puppy":           "HW- The unwanted puppy.jpg",
  "HW- Ellie the homesick puppy":     "HW- Ellie the homesick puppy.jpg",

  // ── Jack Stalwart ─────────────────────────────────────────
  "JS- The puzzle of the missing panda": "JS- The puzzle of the missing panda.jpg",
  "JS- The search of the sunken treasure-Australia": "JS- The search of the sunken treasure-Australia.jpg",
  "JS- Danger on the frozen land Arctic": "JS- Danger on the frozen land Arctic.jpg",
  "JS- The peril at the grand Prix- Italy": "JS- The peril at the grand Prix- Italy.jpg",
  "JS- The theft of the samurai sword- Japan": "JS- The theft of the samurai sword- Japan.jpg",
  "JS- The mission to find max-Egypt": "JS- The mission to find max-Egypt.jpg",
  "JS- The quest of the aztec gold- Mexico": "JS- The quest of the aztec gold- Mexico.jpg",
  "JS- The caper of the crown Jewels- Great Bratain": "JS- The caper of the crown Jewels- Great Bratain.jpg",
  "JS- The escape of the deadly dinosour": "JS- The escape of the deadly dinosour.jpg",

  // ── Famous Five / Secret Seven / Enid Blyton ──────────────
  "Enid Blyton - Famous Five go adventuring again": "Enid Blyton - Famous Five go adventuring again.jpg",
  "Enid Blyton - Go ahead secret seven":            "Enid Blyton - Go ahead secret seven.jpg",
  "Enid Blyton - Three Cheers secret seven":        "Enid Blyton - Three Cheers secret seven.jpg",
  "Famous Five- Where are the secret seven":        "Famous Five- Where are the secret seven.jpg",
  "Enid Blyton- Five on Brexit Island":             "Enid Blyton- Five on Brexit Island.jpg",
  "Enid Blyton- Five go on astrategy away day":     "Enid Blyton- Five go on astrategy away day.jpg",
  "Enid Blyton- Five on a Treasure island":         "Enid Blyton- Five on a Treasure island.jpg",

  // ── Geronimo Stilton ──────────────────────────────────────
  "Geronimo-I am too fond of my fur":           "Geronimo-I am too fond of my fur.jpg",
  "Geronimo-Alien escape":                      "Geronimo-Alien escape.jpg",
  "Geronimo-Four mice deep in the jungle":      "Geronimo-Four mice deep in the jungle.jpg",

  // ── Tom Gates ─────────────────────────────────────────────
  "Tom gates Biscuits bands and big plans":      "Tom gates Biscuits bands and big plans.jpg",
  "Tom Gates- Happy to help":                    "Tom Gates- Happy to help.jpg",
  "Tom gates- A tiny bit lucky":                 "Tom gates- A tiny bit lucky.jpg",
  "Tom gates- Epic Adventure":                   "Tom gates- Epic Adventure.jpg",
  "Tom Gates- Spectacular School Trip":          "Tom Gates- Spectacular School Trip.jpg",
  "Tom Gates- Family Friends and Furry Creatures": "Tom Gates- Family Friends and Furry Creatures.jpg",
  "Tom Gates- Super Good Skills":                "Tom Gates- Super Good Skills.jpg",

  // ── Diary of a Wimpy Kid ──────────────────────────────────
  "Diary of a Wimpy Kid- The last straw":  "Diary of a Wimpy Kid- The last straw.jpg",
  "Diary of a Wimpy Kid- The cabin fever": "Diary of a Wimpy Kid- The cabin fever.jpg",
  "Diary of a Wimpy Kid- The Ugly truth":  "Diary of a Wimpy Kid- The Ugly truth.jpg",

  // ── David Walliams (DW) ───────────────────────────────────
  "DW- Gangsta Granny":                    "DW- Gangsta Granny.jpg",

  // ── Roald Dahl (RD) ───────────────────────────────────────
  "RD- The Twits":                         "RD-  The Twits.jpg",

  // ── Michael Morpurgo ──────────────────────────────────────
  "Michael Morpurgo- Adolphus Tips":            "Michael Morpurgo- Adolphus Tips.jpg",
  "Michael Morpurgo- The nine lives of Montezuma": "Michael Morpurgo- The nine lives of Montezuma.jpg",
  "Michael Morpurgo- Mr Nobody_s eyes":         "Michael Morpurgo- Mr Nobody_s eyes.jpg",

  // ── Other age 7-15 ────────────────────────────────────────
  "The world_s worst teachers":            "The world_s worst teachers.jpg",
  "The world_s worst Pets":               "The world_s worst Pets.jpg",
  "The world_s worst parents":            "The world_s worst parents.jpg",
  "Clanice Beans Spells trouble":          "Clanice Beans Spells trouble.jpg",
  "Clarice beans Dont look now":           "Clarice beans Dont look now.jpg",
  "Clarice beans utterly me":              "Clarice beans utterly me.jpg",
  "Moody Margaret strikes back":           "Moody Margaret strikes back.jpg",
  "How to steal a dragons sword":          "How to steal a dragons sword.jpg",
  "How to speak dragonese":                "How to speak dragonese.jpg",
  "Dork Diaries Pop star":                 "Dork Diaries Pop star.jpg",
  "The 65 story Treehouse":                "The 65 story Treehouse.jpg",
  "The 78 Story Treehouse":                "The 78 Story Treehouse.jpg",
  "The 91 story Treehouse":                "The 91 story Treehouse.jpg",
  "The Lost Island of Tamarind":           "The Lost Island of Tamarind.jpg",
  "The Lost Magician":                     "The Lost Magician.jpg",
  "The Mystery of the Smugglers Wreck":    "The Mystery of the Smugglers Wreck.jpg",
  "the lighthouse keepers Stories":        "the lighthouse keepers Stories.jpg",
  "PugSlay- The puppu place":              "PugSlay- The puppu place.jpg",
  "Racoon Rampage":                        "Racoon Rampage.jpg",
  "Judy Moody declares independence":      "Judy Moody declares independence.jpg",
  "Rivalry at Silver Spires":              "Rivalry at Silver Spires.jpg",
  "Jakes cave":                            "Jakes cave.jpg",
  "Jeremy strong- My brothers famous bottom gets crowned": "Jeremy strong- My brothers famous bottom gets crowned.jpg",
  "Jeremy strong- My brothers hot cross bottom": "Jeremy strong- My brothers hot cross bottom.jpg",
  "Space dog visits planet earth":         "Space dog visits planet earth.jpg",
  "Drawing together":                      "Drawing together.jpg",
  "Grandad_s medal":                       "Grandad_s medal.jpg",
  "Secret seven- well done secrete seven": "Secret seven- well done secrete seven.jpg",
  "Stories for 6 six year old":            "Stories for 6 six year old.jpg",

  // ── Oxford Reading Tree (ORT) ─────────────────────────────
  "Oxford Reading Tree- Bob bug":               "Oxford Reading Tree- Bob bug.jpg",
  "ORT Bob bug":                                "ORT Bob bug.jpg",
  "Oxford Reading Tree- Mums new hat":          "Oxford Reading Tree- Mums new hat.jpg",
  "Oxford Reading Tree- Looking after granny":  "Oxford Reading Tree- Looking after granny.jpg",
  "Oxford Reading Tree- Dads birthday":         "Oxford Reading Tree- Dads birthday.jpg",
  "Oxford Reading Tree- I can trick a tiger":   "Oxford Reading Tree- I can trick a tiger.jpg",
  "Oxford Reading Tree- Holiday in Japan":      "Oxford Reading Tree- Holiday in Japan.jpg",
  "Oxford Reading Tree- The Magic tree":        "Oxford Reading Tree- The Magic tree.jpg",
  "Oxford Reading Tree- The quest":             "Oxford Reading Tree- The quest.jpg",
  "Oxford Reading Tree- The Pancake":           "Oxford Reading Tree- The Pancake.jpg",
  "Oxford Reading Tree- Floppy and the bone":   "Oxford Reading Tree- Floppy and the bone.jpg",
  "Oxford Reading Tree- The palace statue":     "Oxford Reading Tree- The palace statue.jpg",
  "Oxford Reading Tree- Trapped":               "Oxford Reading Tree- Trapped.jpg",
  "Oxford Reading Tree- The Monster hunt":      "Oxford Reading Tree- The Monster hunt.jpg",
  "Oxford Reading Tree- Wet feet":              "Oxford Reading Tree- Wet feet.jpg",
  "Oxford Reading Tree- Drawing adventure":     "Oxford Reading Tree- Drawing adventure.jpg",
  "Oxford Reading Tree- Land of letters":       "Oxford Reading Tree- Land of letters.jpg",
  "Oxford Reading Tree- Egg Fried rice":        "Oxford Reading Tree- Egg Fried rice.jpg",
  "Oxford Reading Tree- Such a fuss":           "Oxford Reading Tree- Such a fuss.jpg",
  "Oxford Reading Tree- Craig saves the day":   "Oxford Reading Tree- Craig saves the day.jpg",
  "Oxford reading free-The bully":              "Oxford reading free-The bully.jpg",
  "Oxford Reading Tree- The Hairy scary monster": "Oxford Reading Tree- The Hairy scary monster.jpg",
  "Oxford Reading Tree- Ouch":                  "Oxford Reading Tree- Ouch.jpg",
  "Kipper collection":                          "Kipper collection.jpg",

  // ── Peppa Pig ─────────────────────────────────────────────
  "Peppa goes skiing":                     "Peppa goes skiing.jpg",
  "Peppa pig and the christmas elf":       "Peppa pig and the christmas elf.jpg",
  "Peppa Pig going swimming":              "Peppa Pig going swimming.jpg",
  "Peppa_s new neighbours":               "Peppa_s new neighbours.jpg",

  // ── Thomas the Train ──────────────────────────────────────
  "Thomas and James":                      "Thomas he train -Thomas and james.jpg",
  "Thomas he train -Trevor":               "Thomas he train -Trevor.jpg",
  "Thomas and the train-creeky cranky":    "Thomas and the train-creeky cranky.jpg",
  "Thomas and the train-Trevot":           "Thomas and the train-Trevot.jpg",

  // ── Disney ────────────────────────────────────────────────
  "Disney- 101 Dalmatians":               "Disney- 101 Dalmatians.jpg",

  // ── When I feel… ──────────────────────────────────────────
  "When I feel Jelous":                    "When I feel Jelous.jpg",
  "When I feel greedy":                    "When I feel greedy.jpg",
  "When I feel Impatient":                 "When I feel Impatient.jpg",
  "When I feel angry":                     "When I feel angry.jpg",

  // ── Mr. Men / Miss... ─────────────────────────────────────
  "Mr. Men":                               "Mr. Men.jpg",
  "Mr Men and Little Miss Treasury":       "Mr Men and Little Miss Treasury.jpg",
  "Mr. Miss Busy":                         "Miss Busy.jpg",
  "Miss contrary":                         "Miss contrary.jpg",
  "Miss trouble changes colour":           "Miss trouble changes colour.jpg",
  "Theprincess ballet":                    "Theprincess ballet.jpg",

  // ── DK Readers ────────────────────────────────────────────
  "DK readers- Avengers":                  "DK readers- Avengers.jpg",
  "DK readers- Thor":                      "DK readers- Thor.jpg",
  "Avengers":                              "Avengers.jpg",
  "Spider-man":                            "Spider-man.jpg",

  // ── age-2-5 misc (new) ────────────────────────────────────
  "Splish Splash Sploosh":                 "Splish Splash Sploosh.jpg",
  "The hungry Otter":                      "The hungry Otter.jpg",
  "DP- Go away":                           "DP- Go away.jpg",
  "DP- It is mine":                        "DP- It is mine.jpg",
  "Harry the highlander":                  "Harry the highlander.jpg",
  "What Mona wants Mona wants":           "What Mona wants Mona wants.jpg",
  "short stories":                         "short stories.jpg",
  "Here comes the crocodile":              "Here comes the crocodile.jpg",
  "Itchy itch itch":                       "Itchy itch itch.jpg",
  "tom and jerry":                         "tom and jerry.jpg",
  "Teddy finds a treasure":                "Teddy finds a treasure.jpg",
  "Happy birthday 3":                      "Happy birthday 3.jpg",
  "Where_s santa_s reindeer":             "Where_s santa_s reindeer.jpg",
  "Boris goes camping":                    "Boris goes camping.jpg",
  "When I grow up":                        "When I grow up.jpg",
  "Shiva":                                 "Shiva.jpg",
  "Recycling fun":                         "Recycling fun.jpg",
  "The bunny bluebell hill":               "The bunny bluebell hill.jpg",
  "Milly and the mermaids":               "Milly and the mermaids.jpg",
  "Chimp with a limp":                     "Chimp with a limp.jpg",
  "Thomas and the train-creeky cranky":    "Thomas and the train-creeky cranky.jpg",

  // ── age-2-5 misc (existing) ───────────────────────────────
  "Elmer again":                           "Elmer again.jpg",
  "Elmer and the stranger":                "Elmer and the stranger.jpg",
  "Down by the cool of the pool":          "Down by the cool of the pool.jpg",
  "Urso Brunov":                           "Urso Brunov.jpg",
  "Mog_s christmas":                      "Mog_s christmas.jpg",
  "Where_s wally the wonder book":        "Where_s wally the wonder book.jpg",
  "Where_s wally the fantastic journey":  "Where_s wally the fantastic journey.jpg",
  "Where_s wally the great picture book": "Where_s wally the great picture book.jpg",
  "Handa_s surprising day":               "Handa_s surprising day.jpg",
  "Teddy Bears Picnic":                    "Teddy Bears Picnic.jpg",
  "The Walloos Big Adventure":             "The Walloos Big Adventure.jpg",
  "Unicorns in Uniforms":                  "Unicorns in Uniforms.jpg",
  "Magnificient Millie":                   "Magnificent Millie.jpg",
  "Luna loves gardening":                  "Luna loves gardening.jpg",
  "Elfa and the box of memories":          "Elfa abd the box of memories.jpg",
  "My friend Grandad":                     "My friend Grandad.jpg",
  "Where_s the unicorn":                  "Where_s the unicorn.jpg",
  "Where_s the sloth":                    "Where_s the sloth.jpg",
  "Where_s the bunny":                    "Where_s the bunny.jpg",
  "The Bunny of Blueberry Hill":           "The Bunny of Blueberry Hill.jpg",
  "Bug in a rug":                          "Bug in a rug.jpg",
  "Dogs day off":                          "Dogs day off.jpg",
  "Happy I am a Hippo":                    "Happy I am a Hippo.jpg",
  "Marchello mouse":                       "Marchello mouse.jpg",
  "5 min bunny tales":                     "5 min bunny tales.jpg",
  "Jacks Little party":                    "Jacks Little party.jpg",
  "Night Flight":                          "Night Flight.jpg",
  "Mac and lauren":                        "Mac and lauren.jpg",
  "Captain America":                       "Captain America.jpg",
  "Small stories":                         "Small stories.jpg",
  "Frozen":                                "Frozen.jpg",
  "Frozen 2":                              "Frozen 2.jpg",
  "Gurraffe in the bath":                  "Gurraffe in the bath.jpg",
  "The very uglu bug":                     "The very uglu bug.jpg",
  "The very sleepy sloth":                 "The very sleepy sloth.jpg",
  "Jack digger helps out":                 "Jack digger helps out.jpg",
  "Princess evie sand pony":               "Princess evie sand pony.jpg",
  "Princess Evie Snow ponie":              "Princess Evie Snow ponie.jpg",
  "Princess evies ponies - sea pony":      "Princess evies ponies - sea pony.jpg",
  "Princess Evies Ponies - Winter":        "Princess Evies Ponies - Winter.jpg",
  "Michael Morpurgo-Escape from ShangriLa": "Michael Morpurgo-Escape from ShangriLa.jpg",
  "VS- What a team":                       "VS- What a team.jpg",
  "Dragon gets by":                        "Dragon gets by.jpg",
  "Norman and the runaway cow":            "Norman and the runaway cow.jpg",
  "Mr. Nosey and the beanstalk":           "Mr. Nosey and the beanstalk.jpg",
  "Spots bedtime book":                    "Spots bedtime book.jpg",
  "Pooh_s grand adventure":              "Pooh_s grand adventure.jpg",
  "The enchanted tree":                    "The enchanted tree.jpg",
  "Ganesha":                               "Ganesha.jpg",
  "Drawing together":                      "Drawing together.jpg"
};

// ─────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('K for Kids Books Library')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ─────────────────────────────────────────────
// ONE-TIME SETUP: Run this from the Apps Script editor
// to write the "Image Name" column into your Master DB sheet.
// ─────────────────────────────────────────────

function setupImageNames() {
  const { sheet, headerRow } = getSheetAndHeader_();
  const data = sheet.getDataRange().getValues();

  // Ensure "Image Name" header exists
  if (!trim_(data[headerRow][C.IMAGE_NAME])) {
    sheet.getRange(headerRow + 1, C.IMAGE_NAME + 1).setValue('Image Name');
  }

  // Build a normalised-title lookup from IMAGE_MAP (covers both bookNo and title keys)
  const titleMap = {};
  for (const [key, val] of Object.entries(IMAGE_MAP)) {
    titleMap[key.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()] = val;
  }

  let updated = 0;
  const updates = [];

  for (let i = headerRow + 1; i < data.length; i++) {
    const bookNo   = trim_(data[i][C.BOOK_NO]);
    const bookName = trim_(data[i][C.BOOK_NAME]);
    if (!bookNo) continue;

    const existing = trim_(data[i][C.IMAGE_NAME]);
    if (existing) continue; // don't overwrite existing entries

    // 1. Exact bookNo match, 2. Normalised title match
    let imagePath = IMAGE_MAP[bookNo] || '';
    if (!imagePath) {
      const nKey = bookName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      imagePath = titleMap[nKey] || '';
    }

    if (imagePath) {
      updates.push({ row: i + 1, value: imagePath });
      updated++;
    }
  }

  // Batch-write for performance
  updates.forEach(u => {
    sheet.getRange(u.row, C.IMAGE_NAME + 1).setValue(u.value);
  });

  // Clear cache so image URLs get rebuilt
  CacheService.getScriptCache().remove('BOOK_IMAGE_MAP');

  Logger.log('✅ setupImageNames: wrote image names for ' + updated + ' books.');
  return { success: true, updated, message: 'Image names written for ' + updated + ' books.' };
}

// ─────────────────────────────────────────────
// Public API (called via google.script.run)
// ─────────────────────────────────────────────

// ── Public books cache (chunked, 5-min TTL) ───────────────────────────────────
const BOOKS_CACHE_KEY   = 'PUBLIC_BOOKS_V2';
const BOOKS_CACHE_SECS  = 300; // 5 minutes
const CHUNK_SIZE        = 90000; // bytes per CacheService entry (limit 100 KB)
const ADMIN_SESSION_SECS = 7200; // 2 hours

function getCachedPublicBooks_() {
  const cache  = CacheService.getScriptCache();
  const meta   = cache.get(BOOKS_CACHE_KEY + '_META');
  if (!meta) return null;
  const chunks = parseInt(meta, 10);
  let json = '';
  for (let i = 0; i < chunks; i++) {
    const part = cache.get(BOOKS_CACHE_KEY + '_' + i);
    if (!part) return null;
    json += part;
  }
  try { return JSON.parse(json); } catch(e) { return null; }
}

function setCachedPublicBooks_(books) {
  const cache = CacheService.getScriptCache();
  const json  = JSON.stringify(books);
  const total = Math.ceil(json.length / CHUNK_SIZE);
  const pairs = { [BOOKS_CACHE_KEY + '_META']: String(total) };
  for (let i = 0; i < total; i++) {
    pairs[BOOKS_CACHE_KEY + '_' + i] = json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
  }
  cache.putAll(pairs, BOOKS_CACHE_SECS);
}

function invalidatePublicBooksCache_() {
  const cache = CacheService.getScriptCache();
  const meta  = cache.get(BOOKS_CACHE_KEY + '_META');
  if (!meta) return;
  const chunks = parseInt(meta, 10);
  const keys   = [BOOKS_CACHE_KEY + '_META'];
  for (let i = 0; i < chunks; i++) keys.push(BOOKS_CACHE_KEY + '_' + i);
  cache.removeAll(keys);
}
// ─────────────────────────────────────────────────────────────────────────────

function getBooks(filters, adminCredential) {
  try {
    const isAdmin = adminCredential ? verifyAdminCredential_(adminCredential) : false;

    // Serve public books from cache when possible (admin always bypasses cache)
    if (!isAdmin && !filters) {
      const cached = getCachedPublicBooks_();
      if (cached) return { success: true, books: cached };
    }

    const { sheet, headerRow } = getSheetAndHeader_();
    const data     = sheet.getDataRange().getValues();
    const imageMap = getImageMap_();
    const tz       = Session.getScriptTimeZone();

    const books = [];
    for (let i = headerRow + 1; i < data.length; i++) {
      const row     = data[i];
      const bookNo  = trim_(row[C.BOOK_NO]);
      if (!bookNo)  continue;

      const language    = trim_(row[C.LANGUAGE]);
      const bookName    = trim_(row[C.BOOK_NAME]);
      const issuedTo    = trim_(row[C.ISSUED_TO]);
      const author      = trim_(row[C.AUTHOR]);
      const publication = trim_(row[C.PUBLICATION]);
      const reservedBy  = trim_(row[C.RESERVED_BY]);
      const phone       = trim_(row[C.PHONE]);
      const notes       = trim_(row[C.NOTES]);

      let status = trim_(row[C.STATUS]);
      if (!status) status = issuedTo ? 'Issued' : 'Available';

      const pickupDate = formatDate_(row[C.PICKUP_DATE], tz);
      const issueDate  = formatDate_(row[C.ISSUE_DATE],  tz);

      if (filters) {
        if (filters.language && language.toLowerCase() !== filters.language.toLowerCase()) continue;
        if (filters.status   && status.toLowerCase()   !== filters.status.toLowerCase())   continue;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          if (!bookName.toLowerCase().includes(q) &&
              !author.toLowerCase().includes(q)   &&
              !bookNo.toLowerCase().includes(q))  continue;
        }
      }

      books.push({
        rowIndex: i + 1,
        srNo: row[C.SR_NO],
        language, bookNo, bookName, author, publication, status,
        imageUrl:   imageMap[bookNo] || '',
        // Admin-only fields — empty string for non-admin
        issuedTo:   isAdmin ? issuedTo   : '',
        reservedBy: isAdmin ? reservedBy : '',
        phone:      isAdmin ? phone       : '',
        pickupDate: isAdmin ? pickupDate  : '',
        issueDate:  isAdmin ? issueDate   : '',
        notes:      isAdmin ? notes       : ''
      });
    }

    // Cache public result for future visitors
    if (!isAdmin && !filters) {
      try { setCachedPublicBooks_(books); } catch(e) { /* non-fatal */ }
    }

    return { success: true, books };
  } catch (err) {
    return reportError_('getBooks', err);
  }
}

function reserveBook(bookNo, subscriberName, phone, pickupDate, notes) {
  try {
    if (!checkRateLimit_('reserve-book', 5, 300)) {
      return { success: false, error: 'Too many reservation attempts. Please try again later.' };
    }
    if (!bookNo || !subscriberName) return { success: false, error: 'Book number and your name are required.' };

    subscriberName = trim_(subscriberName);
    phone          = trim_(phone);
    pickupDate     = trim_(pickupDate);
    notes          = trim_(notes);

    if (subscriberName.length > 100) return { success: false, error: 'Name is too long.' };
    if (phone.length > 40)           return { success: false, error: 'Phone number is too long.' };
    if (notes.length > 500)          return { success: false, error: 'Notes are too long.' };

    const { sheet, headerRow } = getSheetAndHeader_();
    const data = sheet.getDataRange().getValues();

    for (let i = headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][C.BOOK_NO]) !== bookNo.trim()) continue;

      const status   = trim_(data[i][C.STATUS]);
      const issuedTo = trim_(data[i][C.ISSUED_TO]);
      if (issuedTo || (status && status !== 'Available')) {
        return { success: false, error: 'Sorry, this book is no longer available.' };
      }

      const r = i + 1;
      sheet.getRange(r, C.STATUS      + 1).setValue('Reserved');
      sheet.getRange(r, C.RESERVED_BY + 1).setValue(subscriberName);
      sheet.getRange(r, C.PHONE       + 1).setValue(phone);
      sheet.getRange(r, C.PICKUP_DATE + 1).setValue(pickupDate);
      sheet.getRange(r, C.NOTES       + 1).setValue(notes);

      invalidatePublicBooksCache_();
      return { success: true, message: '✅ Book reserved! We will contact you when it\'s ready.' };
    }
    return { success: false, error: 'Book not found.' };
  } catch (err) {
    return reportError_('reserveBook', err);
  }
}

function issueBook(bookNo, subscriberName, issueDate, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    if (!bookNo || !subscriberName)   return { success: false, error: 'Book number and subscriber name required.' };

    const { sheet, headerRow } = getSheetAndHeader_();
    const data = sheet.getDataRange().getValues();

    for (let i = headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][C.BOOK_NO]) !== bookNo.trim()) continue;

      const r        = i + 1;
      const date     = issueDate ? new Date(issueDate) : new Date();
      const bookName = trim_(data[i][C.BOOK_NAME]);

      sheet.getRange(r, C.ISSUED_TO   + 1).setValue(subscriberName.trim());
      sheet.getRange(r, C.STATUS      + 1).setValue('Issued');
      sheet.getRange(r, C.ISSUE_DATE  + 1).setValue(date);
      sheet.getRange(r, C.RESERVED_BY + 1).setValue('');
      sheet.getRange(r, C.PHONE       + 1).setValue('');

      // Log to customer's named tab
      logIssueToCustTab_(subscriberName.trim(), bookNo.trim(), bookName, date);

      invalidatePublicBooksCache_();
      return { success: true, message: '✅ Book marked as issued to ' + subscriberName.trim() };
    }
    return { success: false, error: 'Book not found.' };
  } catch (err) {
    return reportError_('issueBook', err);
  }
}

function returnBook(bookNo, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };

    const { sheet, headerRow } = getSheetAndHeader_();
    const data = sheet.getDataRange().getValues();

    for (let i = headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][C.BOOK_NO]) !== bookNo.trim()) continue;

      const r        = i + 1;
      const issuedTo = trim_(data[i][C.ISSUED_TO]);

      sheet.getRange(r, C.ISSUED_TO   + 1).setValue('');
      sheet.getRange(r, C.STATUS      + 1).setValue('Available');
      sheet.getRange(r, C.ISSUE_DATE  + 1).setValue('');
      sheet.getRange(r, C.RESERVED_BY + 1).setValue('');
      sheet.getRange(r, C.PHONE       + 1).setValue('');
      sheet.getRange(r, C.PICKUP_DATE + 1).setValue('');
      sheet.getRange(r, C.NOTES       + 1).setValue('');

      // Log return to customer's named tab
      if (issuedTo) {
        logReturnToCustTab_(issuedTo, bookNo.trim(), new Date());
      }

      invalidatePublicBooksCache_();
      return { success: true, message: '✅ Book marked as returned and available.' };
    }
    return { success: false, error: 'Book not found.' };
  } catch (err) {
    return reportError_('returnBook', err);
  }
}

function cancelReservation(bookNo, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };

    const { sheet, headerRow } = getSheetAndHeader_();
    const data = sheet.getDataRange().getValues();

    for (let i = headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][C.BOOK_NO]) !== bookNo.trim()) continue;

      const r = i + 1;
      sheet.getRange(r, C.STATUS      + 1).setValue('Available');
      sheet.getRange(r, C.RESERVED_BY + 1).setValue('');
      sheet.getRange(r, C.PHONE       + 1).setValue('');
      sheet.getRange(r, C.PICKUP_DATE + 1).setValue('');
      sheet.getRange(r, C.NOTES       + 1).setValue('');

      invalidatePublicBooksCache_();
      return { success: true, message: '✅ Reservation cancelled.' };
    }
    return { success: false, error: 'Book not found.' };
  } catch (err) {
    return reportError_('cancelReservation', err);
  }
}

// ─────────────────────────────────────────────
// Customer Management (Admin only)
// ─────────────────────────────────────────────

function getCustomers(adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.CUSTOMER_SHEET_NAME);
    if (!sheet) return { success: false, error: 'Customer DB sheet not found.' };

    const data = sheet.getDataRange().getValues();
    const tz   = Session.getScriptTimeZone();

    // Find header row (look for "Name" in column B — may not be at row 1)
    let headerRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][CUST.NAME] || '').toLowerCase().trim() === 'name') {
        headerRow = i; break;
      }
    }
    if (headerRow === -1) return { success: false, error: 'Could not find header row in Customer DB.' };

    const customers = [];
    for (let i = headerRow + 1; i < data.length; i++) {
      const name = trim_(data[i][CUST.NAME]);
      if (!name) continue;
      customers.push({
        srNo:        trim_(data[i][CUST.SR_NO]),
        name,
        dateStart:   formatDate_(data[i][CUST.DATE_START], tz),
        location:    trim_(data[i][CUST.LOCATION]),
        address:     trim_(data[i][CUST.ADDRESS]),
        status:      trim_(data[i][CUST.STATUS]) || 'Active',
        tillDateSum: trim_(data[i][CUST.TILL_DATE_SUM])
      });
    }
    return { success: true, customers };
  } catch (err) {
    return reportError_('getCustomers', err);
  }
}

function addCustomer(name, dateStart, location, address, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    if (!name) return { success: false, error: 'Customer name is required.' };

    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.CUSTOMER_SHEET_NAME);
    if (!sheet) return { success: false, error: 'Customer DB sheet not found.' };

    const data = sheet.getDataRange().getValues();
    let headerRow = -1;
    let maxSrNo   = 0;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][CUST.NAME] || '').toLowerCase().trim() === 'name') {
        headerRow = i; continue;
      }
      if (headerRow >= 0 && trim_(data[i][CUST.NAME])) {
        const sr = parseInt(data[i][CUST.SR_NO]) || 0;
        if (sr > maxSrNo) maxSrNo = sr;
      }
    }
    if (headerRow === -1) return { success: false, error: 'Could not find header row in Customer DB.' };

    sheet.appendRow([
      maxSrNo + 1,
      name.trim(),
      dateStart ? new Date(dateStart) : new Date(),
      (location || '').trim(),
      (address  || '').trim(),
      'Active',
      ''
    ]);
    return { success: true, message: '✅ Customer "' + name.trim() + '" added successfully.' };
  } catch (err) {
    return reportError_('addCustomer', err);
  }
}

function updateCustomerStatus(customerName, newStatus, adminCredential) {
  try {
    if (!verifyAdminCredential_(adminCredential)) return { success: false, error: 'Admin session expired. Please log in again.' };
    if (!customerName || !newStatus)  return { success: false, error: 'Customer name and status required.' };

    const valid = ['Active', 'Inactive', 'Closed'];
    if (!valid.includes(newStatus)) return { success: false, error: 'Invalid status.' };

    const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.CUSTOMER_SHEET_NAME);
    if (!sheet) return { success: false, error: 'Customer DB sheet not found.' };

    const data = sheet.getDataRange().getValues();
    let headerRow = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][CUST.NAME] || '').toLowerCase().trim() === 'name') {
        headerRow = i; break;
      }
    }
    if (headerRow === -1) return { success: false, error: 'Could not find header row in Customer DB.' };

    for (let i = headerRow + 1; i < data.length; i++) {
      if (trim_(data[i][CUST.NAME]).toLowerCase() === customerName.toLowerCase()) {
        sheet.getRange(i + 1, CUST.STATUS + 1).setValue(newStatus);
        return { success: true, message: '✅ Status updated to "' + newStatus + '" for ' + customerName };
      }
    }
    return { success: false, error: 'Customer "' + customerName + '" not found.' };
  } catch (err) {
    return reportError_('updateCustomerStatus', err);
  }
}

// ─────────────────────────────────────────────
// Customer Tab Helpers (private)
// ─────────────────────────────────────────────

/**
 * Finds the customer's named sheet tab.
 * Tries exact match, then case-insensitive, then partial.
 */
function findCustomerSheet_(customerName) {
  const ss     = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const name   = customerName.trim().toLowerCase();

  // Exact match (case-insensitive)
  for (const s of sheets) {
    if (s.getName().toLowerCase() === name) return s;
  }
  // Partial match
  for (const s of sheets) {
    const sName = s.getName().toLowerCase();
    if (sName.includes(name) || name.includes(sName)) return s;
  }
  return null;
}

/**
 * Appends an issue record to the customer's named tab.
 * Tab structure: Row1=location, Row2=headers, Row3+=data
 * Columns: A=empty, B=BookNo, C=BookName, D=IssuedDate, E=ReturnDate, F=Status
 */
function logIssueToCustTab_(customerName, bookNo, bookName, issueDate) {
  try {
    const custSheet = findCustomerSheet_(customerName);
    if (!custSheet) {
      Logger.log('Customer tab not found for: ' + customerName);
      return;
    }
    const date = (issueDate instanceof Date) ? issueDate : (issueDate ? new Date(issueDate) : new Date());
    custSheet.appendRow(['', bookNo, bookName, date, '', 'Issued']);
  } catch (e) {
    Logger.log('logIssueToCustTab_ error: ' + e.message);
  }
}

/**
 * Updates the return date and status in the customer's tab for a given book.
 * Searches from the bottom up to find the last 'Issued' entry for the book.
 */
function logReturnToCustTab_(customerName, bookNo, returnDate) {
  try {
    const custSheet = findCustomerSheet_(customerName);
    if (!custSheet) {
      Logger.log('Customer tab not found for: ' + customerName);
      return;
    }
    const data = custSheet.getDataRange().getValues();
    const date = (returnDate instanceof Date) ? returnDate : (returnDate ? new Date(returnDate) : new Date());

    // Columns B=index 1 (BookNo), E=index 4 (ReturnDate), F=index 5 (Status)
    for (let i = data.length - 1; i >= 0; i--) {
      const rowBookNo = trim_(data[i][1]);
      const rowStatus = trim_(data[i][5]);
      if (rowBookNo === bookNo && (rowStatus === 'Issued' || rowStatus === '')) {
        custSheet.getRange(i + 1, 5).setValue(date);       // Col E: Return Date
        custSheet.getRange(i + 1, 6).setValue('Returned'); // Col F: Status
        return;
      }
    }
    Logger.log('No open issued record for book ' + bookNo + ' in tab for ' + customerName);
  } catch (e) {
    Logger.log('logReturnToCustTab_ error: ' + e.message);
  }
}

function loginAdmin(password) {
  try {
    if (!checkRateLimit_('admin-login', 10, 300)) {
      return { success: false, error: 'Too many login attempts. Please try again later.' };
    }
    if (!verifyAdmin_(password)) return { success: false, error: 'Incorrect admin password.' };

    const token = Utilities.getUuid() + Utilities.getUuid();
    CacheService.getScriptCache().put(adminSessionKey_(token), '1', ADMIN_SESSION_SECS);
    return { success: true, token };
  } catch (err) {
    return reportError_('loginAdmin', err);
  }
}

function logoutAdminSession(token) {
  try {
    if (token) CacheService.getScriptCache().remove(adminSessionKey_(token));
  } catch (err) {
    Logger.log('logoutAdminSession error: ' + err.message);
  }
  return { success: true };
}

function verifyAdminPassword(password) {
  if (!checkRateLimit_('admin-password-check', 10, 300)) return false;
  return verifyAdmin_(password);
}

function changeAdminPassword(currentPassword, newPassword) {
  if (!checkRateLimit_('admin-password-change', 5, 300)) return { success: false, error: 'Too many attempts. Please try again later.' };
  if (!verifyAdmin_(currentPassword))     return { success: false, error: 'Current password incorrect.' };
  if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters.' };
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', newPassword);
  return { success: true, message: 'Password updated.' };
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function getSheetAndHeader_() {
  const ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.MASTER_SHEET_NAME + '" not found.');

  const data = sheet.getDataRange().getValues();
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const cell = String(data[i][C.BOOK_NO] || '').toLowerCase().trim();
    if (cell === 'book no.' || cell === 'book no') { headerRow = i; break; }
  }
  if (headerRow === -1) throw new Error('Could not find header row in "' + CONFIG.MASTER_SHEET_NAME + '".');

  // Ensure new column headers exist
  const newHeaders = ['Status','Reserved By','Phone','Pickup Date','Issue Date','Notes','Image Name'];
  newHeaders.forEach((h, idx) => {
    const col = C.STATUS + idx;
    if (!trim_(data[headerRow][col])) {
      sheet.getRange(headerRow + 1, col + 1).setValue(h);
    }
  });

  return { sheet, headerRow };
}

/**
 * Builds bookNo → thumbnail URL map.
 * 1. Scans Drive folders for filename → fileId map.
 * 2. Reads "Image Name" column from sheet.
 * 3. Joins them: bookNo → thumbnail URL.
 * Cached for 30 minutes.
 */
function getImageMap_() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get('BOOK_IMAGE_MAP');
  if (cached) return JSON.parse(cached);

  // Step 1: filename (lowercase) → fileId
  const fileIdMap = {};
  CONFIG.IMAGE_FOLDER_IDS.forEach(folderId => {
    try {
      const folder = DriveApp.getFolderById(folderId);
      // Also check subfolders (age-7-15, age-2-5)
      const subFolders = folder.getFolders();
      while (subFolders.hasNext()) {
        const sub   = subFolders.next();
        const files = sub.getFiles();
        while (files.hasNext()) {
          const f = files.next();
          fileIdMap[f.getName().toLowerCase()] = f.getId();
        }
      }
      // Also check files directly in the folder
      const files = folder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        fileIdMap[f.getName().toLowerCase()] = f.getId();
      }
    } catch (e) { Logger.log('Drive folder error: ' + e.message); }
  });

  // Step 2: Read Image Name column from sheet
  const { sheet, headerRow } = getSheetAndHeader_();
  const data = sheet.getDataRange().getValues();

  const map = {};
  for (let i = headerRow + 1; i < data.length; i++) {
    const bookNo    = trim_(data[i][C.BOOK_NO]);
    const imagePath = trim_(data[i][C.IMAGE_NAME]);  // e.g. "Horrid Henry- Revenge.jpg"
    if (!bookNo || !imagePath) continue;

    const fname  = imagePath.split('/').pop().toLowerCase();  // just the filename
    const fileId = fileIdMap[fname];
    if (fileId) {
      map[bookNo] = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';
    }
  }

  try { cache.put('BOOK_IMAGE_MAP', JSON.stringify(map), 1800); } catch (e) {}
  return map;
}

function verifyAdmin_(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  return Boolean(stored) && password === stored;
}

function verifyAdminCredential_(credential) {
  if (!credential) return false;
  const key = adminSessionKey_(credential);
  const cache = CacheService.getScriptCache();
  if (cache.get(key) !== '1') return false;

  // Sliding expiry while the admin is actively using the app.
  cache.put(key, '1', ADMIN_SESSION_SECS);
  return true;
}

function adminSessionKey_(token) {
  return 'ADMIN_SESSION_' + String(token || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 100);
}

function checkRateLimit_(scope, maxAttempts, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const key   = 'RATE_' + scope + '_' + callerKey_();
  const count = parseInt(cache.get(key) || '0', 10);
  if (count >= maxAttempts) return false;
  cache.put(key, String(count + 1), windowSeconds);
  return true;
}

function callerKey_() {
  try {
    return Session.getTemporaryActiveUserKey() || 'anonymous';
  } catch (e) {
    return 'anonymous';
  }
}

function reportError_(context, err) {
  Logger.log(context + ' error: ' + (err && err.message ? err.message : err));
  return { success: false, error: 'Something went wrong. Please try again.' };
}

function trim_(val) {
  return String(val == null ? '' : val).trim();
}

function formatDate_(val, tz) {
  if (!val || val === '') return '';
  try { return Utilities.formatDate(new Date(val), tz, 'dd/MM/yyyy'); }
  catch (e) { return String(val); }
}
