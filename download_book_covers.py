#!/usr/bin/env python3
"""
Download high-quality book cover images from Open Library + Google Books.

Usage:
    python3 download_book_covers.py                     # download missing
    python3 download_book_covers.py --redownload        # replace all
    python3 download_book_covers.py --workers 8         # set parallelism
    python3 download_book_covers.py --min-size 200x250  # quality threshold (WxH px)

Images saved to ./book-images/ as "{BookNo} - {Title}.jpg"
Existing good-quality images are skipped by book number unless --redownload is used.
Low-quality images (below --min-size) are rejected on download AND
any existing low-quality files in book-images/ are deleted at startup.
"""

import os
import io
import json
import urllib.request
import urllib.parse
import time
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image

SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "book-images")
os.makedirs(SAVE_DIR, exist_ok=True)
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".gif")

# Pass --redownload to overwrite any existing files
REDOWNLOAD = "--redownload" in sys.argv

# Pass --workers N to set parallelism (default 5)
_w = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--workers" and i + 1 < len(sys.argv)), "5")
WORKERS = int(_w)

# Pass --min-size WxH to set the minimum acceptable image dimensions (default 200x250)
_ms = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--min-size" and i + 1 < len(sys.argv)), "200x250")
MIN_W, MIN_H = (int(x) for x in _ms.split("x"))

# (book_no, display_title, search_query, author_hint)
# Franklin series: Marathi titles mapped to English originals for searching
BOOKS = [
    ("M0001", "Franklin chi christmas bhet",       "Franklin's Christmas Gift",          "Paulette Bourgeois"),
    ("M0002", "Franklin abhar manato",             "Franklin Says Thank You",            "Paulette Bourgeois"),
    ("M0003", "Franklin cha gupt club",            "Franklin's Secret Club",             "Paulette Bourgeois"),
    ("M0004", "Franklin chi pitukali bahin",       "Franklin's Baby Sister",             "Paulette Bourgeois"),
    ("M0005", "Franklin chi dadagiri",             "Franklin and the Bully",             "Paulette Bourgeois"),
    ("M0006", "Franklin haravato",                 "Franklin is Lost",                   "Paulette Bourgeois"),
    ("M0007", "Franklin thap marato",              "Franklin Plays the Game",            "Paulette Bourgeois"),
    ("M0008", "Franklin ani andhar gudup",         "Franklin in the Dark",               "Paulette Bourgeois"),
    ("M0009", "Franklin ani hariet",               "Franklin and Harriet",               "Paulette Bourgeois"),
    ("M0010", "Franklin chi valentine card",       "Franklin's Valentines",              "Paulette Bourgeois"),
    ("M0011", "Franklin ani football spardha",     "Franklin Plays Football",            "Paulette Bourgeois"),
    ("M0012", "Franklin ani dantpari",             "Franklin and the Tooth Fairy",       "Paulette Bourgeois"),
    ("M0013", "Franklin cha shejar",               "Franklin's Neighborhood",            "Paulette Bourgeois"),
    ("M0014", "Franklin cycle chalavto",           "Franklin Rides a Bike",              "Paulette Bourgeois"),
    ("M0015", "Shalechya natkat franklin",         "Franklin's School Play",             "Paulette Bourgeois"),
    ("M0016", "Franklin cha pasara",               "Franklin's Mess",                    "Paulette Bourgeois"),
    ("M0017", "Franklin shalet jato",              "Franklin Goes to School",            "Paulette Bourgeois"),
    ("M0018", "Franklin cha nava mitra",           "Franklin's New Friend",              "Paulette Bourgeois"),
    ("M0019", "Franklin mhanato mala tu awadtes",  "Franklin Says I Love You",           "Paulette Bourgeois"),
    ("M0020", "chal atap lavkar Franklin",         "Hurry Up Franklin",                  "Paulette Bourgeois"),
    ("M0021", "Franklin chya shalechi trip",       "Franklin's Class Trip",              "Paulette Bourgeois"),
    ("M0022", "Franklin hospital madhe bharati hoto","Franklin Goes to the Hospital",    "Paulette Bourgeois"),
    ("M0023", "Franklin ani paliv prani",          "Franklin Wants a Pet",               "Paulette Bourgeois"),
    ("M0024", "Shur Bachade",                      "Shur Bachade",                       None),
    ("M0025", "Udnaryancha Talaw",                 "Udnaryancha Talaw",                  None),
    ("M0026", "Prem Karu ya Pruthvivar",           "Prem Karu ya Pruthvivar",            None),
    ("M0027", "Chiku Piku Feb 2025",               "Chiku Piku children magazine",       None),
    ("M0028", "Chiku Piku Mar 2025",               "Chiku Piku children magazine",       None),
    ("M0029", "Chiku Piku Dec 2024",               "Chiku Piku children magazine",       None),
    ("M0030", "Sampurna Mahabharat",               "Sampurna Mahabharat",                None),
    ("M0031", "Sampura Ramayan",                   "Sampurna Ramayan",                   None),
    ("M0032", "Ekagrchitt Arjun",                  "Ekagrchitt Arjun",                   "Gayatri Pataskar"),
    ("M0033", "Adnyadharak Aaruni",                "Adnyadharak Aaruni",                 "Gayatri Pataskar"),
    ("M0034", "Krushna bappa ne uchalala Bhal mottha ukhal", "Krishna children Marathi", None),
    ("M0035", "Krushna and govardhan parvat",      "Krishna govardhan parvat children",  None),
    ("M0036", "Bappala Ganapati ka mhantat",       "Ganapati children Marathi",          None),
    ("M0037", "Saglyat aadhi Bappachi pooja ka kartat", "Ganapati pooja children Marathi", None),
    ("M0038", "Ganpati bappa la durva ka awadtat", "Ganapati durva children Marathi",   None),
    ("E0045", "My first shaped board book Monkey", "My first shaped board book Monkey", None),
    ("E0046", "What am I Goat",                    "What am I Goat children",            None),
    ("E0047", "All about me Dog",                  "All about me Dog children",          None),
    ("E0049", "All about me Penguine",             "All about me Penguin children",      None),
    ("E0050", "The camel and the car",             "The camel and the car",              None),
    ("E0051", "The animals of farthing wood Fire", "The animals of farthing wood",       "Colin Dann"),
    ("E0052", "The animals of farthing wood Spring Awakening", "The animals of farthing wood Spring Awakening", "Colin Dann"),
    ("E0053", "The animals of farthing wood To the rescue", "The animals of farthing wood rescue", "Colin Dann"),
    ("E0054", "Nini learns to forgive",            "Nini learns to forgive",             None),
    ("E0055", "Princess Poppy Get well soon",      "Princess Poppy Get well soon",       "Janey Louise Jones"),
    ("E0056", "Alfie wins a prize",                "Alfie wins a prize",                 "Shirley Hughes"),
    ("E0057", "Bob bug and other stories big book","Bob bug and other stories",          None),
    ("E0059", "Bob bug and other stories",         "Bob bug Read with Oxford",           None),
    ("E0060", "I love bears",                      "I love bears",                       None),
    ("E0062", "Pip the different penguine",        "Pip the different penguin",          None),
    ("E0069", "Peppa pig Sports day small",        "Peppa pig Sports day Ladybird",      None),
    ("E0072", "Northen forests",                   "Northern forests Robert Snedden",    "Robert Snedden"),
    ("E0073", "I love big cats",                   "I love big cats Miles Kelly",        None),
    ("E0076", "Lesly the yellow ladybird",         "Lesly the yellow ladybird",          None),
    ("E0077", "The innocent lamb and the wolf",    "The innocent lamb and the wolf",     None),
    ("E0078", "Mikes flight",                      "Mike's flight children book",        None),
    ("E0079", "Meg the hen",                       "Meg the hen children",               None),
    ("E0080", "Marvel spider man super origin",    "Marvel spider man super origin DK",  None),
    ("E0081", "Princess Evies ponies Star sand pony", "Princess Evie ponies Star sand pony", "Sarah Killbride"),
    ("E0082", "Princess Evies ponies Silver snow pony", "Princess Evie ponies Silver snow pony", "Sarah Killbride"),
    ("E0083", "Carmel and Vanille",                "Carmel and Vanille",                 "Miriam Moss"),
    ("M0083", "Radhache ghar",                     "Radhache ghar Madhuri Purandare",    "Madhuri Purandare"),
    ("E0085", "Encyclopedia Ocean world",          "Encyclopedia Ocean world Dreamland", None),
    ("E0086", "Noddy and his car",                 "Noddy and his car",                  "Enid Blyton"),
    ("E0088", "First book of numbers",             "First book of numbers",              "Stephen Cartwright"),
    ("E0089", "365 things to make and do",         "365 things to make and do children", None),
    ("E0090", "Noddy and magic rubber",            "Noddy and magic rubber",             "Enid Blyton"),
    ("E0092", "Encyclopedia Animal kingdom",       "Encyclopedia Animal kingdom Dreamland", None),
    ("M0093", "Sonya",                             "Sonya Madhuri Talwalkar",            None),
    ("M0094", "Krushn bappa chya tondat akkhe jag","Krishna children Marathi",           None),
    ("E0096", "Vishnu",                            "Vishnu Hindu children book",         None),
    ("E0098", "Hanuman",                           "Hanuman Hindu children book",        None),
    ("E0099", "Rama",                              "Rama Hindu children picture book",   None),
    ("E0100", "The Frightened Owl",                "The Frightened Owl",                 None),
    ("E0101", "Bedtime Rabbit stories",            "Bedtime Rabbit stories",             None),
    ("E0103", "who am I Owl",                      "who am I Owl children book",         None),
    ("E0106", "My first nature book",              "My first nature book",               None),
    ("E0107", "The tale of Urso Brunov",           "The tale of Urso Brunov",            None),
    ("E0116", "Marchello mouse",                   "Marchello mouse children",           None),
    ("E0117", "The Treasure Hunt",                 "The Treasure Hunt children",         None),
    ("E0122", "100 Facts Pirates",                 "100 Facts Pirates",                  None),
    ("E0123", "100 Facts Vikings",                 "100 Facts Vikings",                  None),
    ("E0133", "Disney Wonderful world Dinosaurs",  "Disney wonderful world knowledge dinosaurs", None),
    ("E0145", "Bringing down the moon",            "Bringing down the moon",             None),
    ("E0146", "Dumbo",                             "Dumbo Disney children",              None),
    ("E0148", "Peppa Pig School bus trip",         "Peppa Pig School bus trip",          None),
    ("E0150", "Dinosaurs Usborne Discovery",       "Dinosaurs Usborne Discovery",        None),
    ("E0151", "Three bags full",                   "Three bags full",                    None),
    ("E0152", "I wonder why Triceratops had horns","I wonder why Triceratops had horns", None),
    ("E0153", "Over 1000 fantastic facts",         "Over 1000 fantastic facts",          None),
    ("E0154", "Over 1000 fantastic History facts", "Over 1000 fantastic History facts",  None),
    ("E0155", "Thomas Race for the Sodor cup",     "Thomas and Friends Race Sodor cup",  None),
    ("E0156", "Troublesome trucks Thomas",         "Troublesome trucks Thomas train",     None),
    ("E0158", "No sleep for cranky Thomas",        "No sleep for cranky Thomas",         None),
    ("E0159", "Dont bother victor Thomas",         "Don't bother victor Thomas train",   None),
    ("E0160", "Dennis Thomas",                     "Dennis Thomas train book",           None),
    ("E0161", "Sir Handel Thomas",                 "Sir Handel Thomas train book",       None),
    ("E0162", "The lost Puff Thomas",              "The lost Puff Thomas train",         None),
    ("E0163", "Creak Cranky Thomas",               "Creak Cranky Thomas train",          None),
    ("E0164", "Murdoch Thomas",                    "Murdoch Thomas train book",          None),
    ("E0166", "Trevor Thomas",                     "Trevor Thomas train book",           None),
    ("E0167", "Hector Thomas",                     "Hector Thomas train book",           None),
    ("E0168", "Cranky Thomas",                     "Cranky Thomas train book",           None),
    ("E0169", "James Thomas",                      "James Thomas train book",            None),
    ("E0170", "Elizabeth Thomas",                  "Elizabeth Thomas train book",        None),
    ("E0171", "Caroline Thomas",                   "Caroline Thomas train book",         None),
    ("E0172", "Emily Thomas",                      "Emily Thomas train book",            None),
    ("E0176", "Eyewitness Jungle",                 "Eyewitness Jungle DK",               None),
    ("E0177", "Explore Space and Universe",        "Explore Space Universe Dreamland",   None),
    ("E0178", "Endangered Planet",                 "Endangered Planet",                  None),
    ("E0179", "Dangerous Creatures",               "Dangerous Creatures children",       None),
    ("E0180", "Mirror Island ORT",                 "Mirror Island Oxford Reading Tree",  None),
    ("E0182", "The pancake ORT",                   "The pancake Oxford Reading Tree",    None),
    ("E0183", "The raft race ORT",                 "The raft race Oxford Reading Tree",  None),
    ("E0184", "Super dad ORT",                     "Super dad Oxford Reading Tree",      None),
    ("E0186", "Pocket Money ORT",                  "Pocket Money Oxford Reading Tree",   None),
    ("E0187", "Mountain rescue ORT",               "Mountain rescue Oxford Reading Tree",None),
    ("E0188", "Uncle Max ORT",                     "Uncle Max Oxford Reading Tree",      None),
    ("E0189", "Hairy-Scary Monster ORT",           "Hairy Scary Monster Oxford Reading Tree", None),
    ("E0190", "The cross rabbit",                  "The cross rabbit children",          None),
    ("E0191", "Princess Evies Ponies Neptune Sea Pony", "Princess Evie Neptune Sea Pony", "Sarah Killbride"),
    ("E0192", "Princess Evies Ponies Confetti Wedding Pony", "Princess Evie Confetti Wedding Pony", "Sarah Killbride"),
    ("E0194", "Disney Dumbo",                      "Disney Dumbo book",                  None),
    ("E0195", "The Owl who was Afraid of the dark","The Owl who was Afraid of the dark", None),
    ("E0196", "Yertle the turtle",                 "Yertle the turtle",                  "Dr. Seuss"),
    ("E0197", "I wonder why Kangaroos have pouches","I wonder why Kangaroos have pouches",None),
    ("E0200", "Catch it Kitty",                    "Catch it Kitty",                     None),
    ("E0214", "The Jungle book",                   "The Jungle book",                    None),
    ("E0215", "Peter pan",                         "Peter pan",                          None),
    ("E0217", "Alladin and the magic lamp",        "Aladdin and the magic lamp",         None),
    ("E0219", "Alibaba and the forty thieves",     "Ali baba and the forty thieves",     None),
    ("E0221", "Treasure Island",                   "Treasure Island",                    None),
    ("E0224", "Chocolate pudding Easy reading",    "Chocolate pudding Easy reading",     None),
    ("E0226", "The lion and the mouse",            "The lion and the mouse",             None),
    ("E0228", "Famous Jataka tales",               "Famous Jataka tales",                None),
    ("E0229", "Famous tales of Akbar Birbal",      "Famous tales of Akbar Birbal",       None),
    ("E0231", "Babloo goes shopping",              "Babloo goes shopping",               None),
    ("E0232", "A quiet night in",                  "A quiet night in",                   "Jill Murphy"),
    ("E0233", "Just like Floss",                   "Just like Floss",                    None),
    ("E0234", "Handsome Hog",                      "Handsome Hog children book",         None),
    ("E0237", "Its a George Thing",               "It's a George Thing children",        None),
    ("E0238", "Oscar and his woodland friends",    "Oscar and his woodland friends",     None),
    ("E0239", "Planet Earth children book",        "Planet Earth children book DK",      None),
    ("E0241", "Harry and the Dinosaurs go to school","Harry and the Dinosaurs go to school", None),
    ("E0244", "The Mighty Thor",                   "The Mighty Thor DK Marvel",          None),
    ("E0245", "The funny foot prints",             "The funny foot prints children",     None),
    ("E0246", "Teddy goes on stage",               "Teddy goes on stage",                None),
    ("E0258", "101 Dalmatians",                    "101 Dalmatians Disney",              None),
    ("E0261", "Flash and the butterfly",           "Flash and the butterfly",            None),
    ("E0263", "Harry and the Robots",              "Harry and the Robots",               None),
    ("E0264", "100 facts Space",                   "100 facts Space",                    None),
    ("E0266", "Kippers snowy day",                 "Kipper snowy day",                   None),
    ("E0267", "Run for it",                        "Run for it children Oxford",         None),
    ("E0268", "Spiderman worst enemies",           "Spiderman worst enemies Marvel",     None),
    ("E0274", "Little miss Giggles new job",       "Little miss Giggles new job",        None),
    ("E0275", "Little miss contrary muddle",       "Little miss contrary muddle",        None),
    ("E0278", "Little miss late takes her time",   "Little miss late takes her time",    None),
    ("E0284", "Mr Happy at sports day",            "Mr Happy at sports day",             None),
    ("E0285", "Mr men and the big match",          "Mr men and the big match",           None),
    ("E0288", "Big little bus Ladybird",           "Big little bus Ladybird",            None),
    ("E0289", "Daisy little dancer",               "Daisy little dancer",                None),
    ("E0291", "Brilliant Little Elephant",         "Brilliant Little Elephant Ladybird", None),
    ("E0294", "Harry and the snow king",           "Harry and the snow king",            None),
    ("E0296", "Ganesha Board book",                "Ganesha children board book",        None),
    ("E0304", "Only one woof",                     "Only one woof",                      None),
    ("E0305", "The magic finger",                  "The magic finger",                   "Roald Dahl"),
    ("E0306", "Boy Tales of childhood",            "Boy Tales of childhood",             "Roald Dahl"),
    ("E0307", "Georges Marvellous Medicine",       "George's Marvellous Medicine",       "Roald Dahl"),
    ("E0308", "Fantastic Mr Fox",                  "Fantastic Mr Fox",                   "Roald Dahl"),
    ("E0309", "The BFG",                           "The BFG",                            "Roald Dahl"),
    ("E0310", "The witches",                       "The witches",                        "Roald Dahl"),
    ("E0311", "The magic of the lost story",       "The magic of the lost story",        "Sudha Murthy"),
    ("E0314", "Grandparents bag of stories",       "Grandparents bag of stories",        "Sudha Murthy"),
    ("E0315", "The magic of the lost temple",      "The magic of the lost temple",       "Sudha Murthy"),
    ("E0319", "Marvel worlds mightiest heroes",    "Marvel worlds mightiest super hero team DK", None),
    ("E0323", "Peppa Recycling Fun",               "Peppa Recycling Fun",                None),
    ("E0331", "Aesop fables",                      "Aesop fables children",              None),
    ("E0333", "I wonder why Pyramids were built",  "I wonder why Pyramids were built",   None),
    ("E0334", "Animal Kingdom",                    "Animal Kingdom children book",       None),
    ("E0335", "Why do humans have two legs",       "Why do humans have two legs",        None),
    ("E0337", "A tale of trouble",                 "A tale of trouble children",         None),
    ("E0340", "Mr Greedy",                         "Mr Greedy",                          None),
    ("E0346", "Little Miss Busy",                  "Little Miss Busy",                   None),
    ("E0350", "Esio Trot",                         "Esio Trot",                          "Roald Dahl"),
    ("E0352", "Danny the champion of the world",   "Danny the champion of the world",    "Roald Dahl"),
    ("E0354", "Holiday in Japan",                  "Holiday in Japan Oxford reading",    None),
    ("E0355", "Missing children book",             "Missing Oxford reading tree",        None),
    ("E0357", "Lion Basic book",                   "Lion children book",                 None),
    ("E0358", "Turtle Basic book",                 "Turtle children book",               None),
    ("E0366", "Naisha at the Market",              "Naisha at the Market",               None),
    ("E0369", "Bella gets her skates",             "Bella gets her skates",              None),
    ("E0390", "The Bumble Bear",                   "The Bumble Bear",                    None),
    ("E0391", "A Mouse so small",                  "A Mouse so small",                   None),
    ("E0392", "A bat mouse",                       "A bat mouse",                        None),
    ("E0393", "Albert and Sarah Jane",             "Albert and Sarah Jane",              None),
    ("E0394", "Little dear lost",                  "Little dear lost",                   None),
    ("E0395", "Paddington Tutti Frutti Rainbow",   "Paddington Tutti Frutti Rainbow",    None),
    ("E0396", "The Peter Rabbit club",             "The Peter Rabbit club",              None),
    ("E0397", "Puffin Peter",                      "Puffin Peter book",                  None),
    ("E0399", "Harry and the Dinosaurs United",    "Harry and the Dinosaurs United",     None),
    ("E0400", "The Dinky Donkey",                  "The Dinky Donkey",                   None),
    ("E0401", "Harry and the Dinosaurs at the Museum","Harry and the Dinosaurs Museum",  None),
    ("E0403", "Selected stories from Panchatantra","Selected stories Panchatantra",      None),
    ("E0404", "Harry the Highlander up the Glen",  "Harry the Highlander up the Glen",  None),
    ("E0405", "Virtue stories Never give up",      "Virtue stories Never give up",       None),
    ("E0407", "White fang",                        "White fang",                         None),
    ("E0409", "Tom Gates Top of the class",        "Tom Gates Top of the class",         "Liz Pichon"),
    ("E0410", "The tiger who came to tea",         "The tiger who came to tea",          None),
    ("E0411", "Mog in the dark",                   "Mog in the dark",                    None),
    ("E0412", "Peppa and christmas elf",           "Peppa and christmas elf",            None),
    ("E0413", "Character building I am sorry",     "Character building I am sorry",      None),
    ("E0414", "Character building Dont do that",   "Character building Don't do that",   None),
    ("E0417", "Taming the Anger Monster",          "Taming the Anger Monster",           None),
    ("E0418", "The Monster Hunt",                  "The Monster Hunt children",          None),
    ("E0419", "Moody children book",               "Moody children book",                None),
    ("E0420", "I love big whales and dolphins",    "I love big whales and dolphins",     None),
    ("E0423", "Naisha at the book shop",           "Naisha at the book shop",            None),
    ("E0424", "Help is on the way",                "Help is on the way children",        None),
    ("E0428", "Shock for the secret seven",        "Shock for the secret seven",         "Enid Blyton"),
    ("E0429", "The Sea of Adventure",              "The Sea of Adventure",               "Enid Blyton"),
    ("E0430", "Good work secret seven",            "Good work secret seven",             "Enid Blyton"),
    ("E0431", "Secret seven well done",            "Secret seven well done",             "Enid Blyton"),
    ("E0434", "The secret seven adventure",        "The secret seven adventure",         "Enid Blyton"),
    ("E0435", "DOWK The ugly truth",               "Diary of a Wimpy Kid The ugly truth","Jeff Kinney"),
    ("E0436", "DOWK The last straw",               "Diary of a Wimpy Kid The last straw","Jeff Kinney"),
    ("E0437", "DOWK Dog days",                     "Diary of a Wimpy Kid Dog days",      "Jeff Kinney"),
    ("E0438", "DOWK Old school",                   "Diary of a Wimpy Kid Old school",    "Jeff Kinney"),
    ("E0439", "DOWK The third wheel",              "Diary of a Wimpy Kid The third wheel","Jeff Kinney"),
    ("E0440", "DOWK No Brainer",                   "Diary of a Wimpy Kid No Brainer",    "Jeff Kinney"),
    ("E0441", "The secret mermaid Turtle trouble", "The secret mermaid Turtle trouble",  None),
    ("E0442", "The Secret Mermaid Dolphin Danger", "The Secret Mermaid Dolphin Danger",  None),
    ("E0443", "The secret Mermaid Reef Rescue",    "The secret Mermaid Reef Rescue",     None),
    ("E0444", "The secret Mermaid Underwater Magic","The secret Mermaid Underwater Magic",None),
    ("E0445", "Fairy Unicorns Enchanted river",    "Fairy Unicorns Enchanted river",     None),
    ("E0446", "The Pony Mag Princess rescue",      "Pony Mag Princess rescue",           None),
    ("E0447", "Oliver Moon troll trouble",         "Oliver Moon and the troll trouble",  None),
    ("E0448", "Oliver Moon broomstick battle",     "Oliver Moon and broomstick battle",  None),
    ("E0451", "Arabian nights",                    "Arabian nights children",            None),
    ("E0452", "The secret seven",                  "The secret seven",                   "Enid Blyton"),
    ("E0453", "Secret seven on the trail",         "Secret seven on the trail",          "Enid Blyton"),
    ("E0454", "DOWK Cabin fever",                  "Diary of a Wimpy Kid Cabin fever",   "Jeff Kinney"),
    ("E0455", "DOWK Rodrick rules",                "Diary of a Wimpy Kid Rodrick rules", "Jeff Kinney"),
    ("E0457", "The Red Car",                       "The Red Car children",               None),
    ("E0458", "Simon Sock",                        "Simon Sock book",                    None),
    ("E0459", "Naisha at the toy shop",            "Naisha at the toy shop",             None),
    ("E0461", "Tom Gates Absolutely Fantastic",    "Tom Gates Absolutely Fantastic",     "Liz Pichon"),
    ("E0464", "Roald Dahl The Twits",              "The Twits",                          "Roald Dahl"),
    ("E0468", "Tom Gates Super Good Skills Almost","Tom Gates Super Good Skills Almost", "Liz Pichon"),
    ("E0476", "A barn on fire",                    "A barn on fire children",            None),
    ("E0479", "I love Spiders",                    "I love Spiders book",                None),
    ("E0480", "Cool as a cucumber",                "Cool as a cucumber children",        None),
    ("E0481", "It could have been worse",          "It could have been worse",           None),
    ("E0482", "How lion became king Tinga Tinga",  "How lion became king Tinga Tinga Land",None),
    ("E0484", "The grumpy goat",                   "The grumpy goat",                    None),
    ("E0485", "Scarecrows secret",                 "Scarecrow's secret children",        None),
    ("E0486", "Woolly stops the train",            "Woolly stops the train",             None),
    ("E0487", "Harry dinosaur happy birthday",     "Harry and the dinosaur happy birthday",None),
    ("E0488", "Character building Dont say that",  "Character building children",        None),
    ("E0489", "Character building move over",      "Character building move over",       None),
    ("E0490", "Character building No thanks",      "Character building No thanks",       None),
    ("E0491", "Character building Angry",          "Character building Angry children",  None),
    ("E0492", "Character building Afraid",         "Character building Afraid children", None),
    ("E0494", "Virtue stories Lets shake hands",   "Virtue stories Lets shake hands",    None),
    ("E0495", "Virtue stories truth",              "Virtue stories When in doubt truth", None),
    ("E0496", "Virtue stories How kind",           "Virtue stories How kind",            None),
    ("E0497", "Burglers breakfast",                "Burglar's breakfast children",       None),
    ("E0498", "Character building It is mine",     "Character building It is mine",      None),
    ("E0499", "Elmer and the teddy",               "Elmer and the teddy",                None),
    ("E0501", "A Forest Divided",                  "A Forest Divided children",          None),
    ("E0503", "Peter Rabbit Treehouse Rescue",     "Peter Rabbit Treehouse Rescue",      None),
    ("E0504", "Lets read Ramayana",                "Let's read Ramayana",                None),
    ("E0511", "Person Controller",                 "Person Controller David Baddiel",    "David Baddiel"),
    ("E0518", "DB The Birthday Boy",               "David Baddiel Birthday Boy",         "David Baddiel"),
    ("E0525", "Super Good skills Tom Gates",       "Tom Gates Super Good skills",        "Liz Pichon"),
    ("E0528", "Captain Underpants 3",              "Captain Underpants 3",               "Dav Pilkey"),
    ("E0531", "Captain Underpants 6",              "Captain Underpants 6",               "Dav Pilkey"),
    ("E0533", "Captain Underpants 8",              "Captain Underpants 8",               "Dav Pilkey"),
    ("E0536", "Captain Underpants 11",             "Captain Underpants 11",              "Dav Pilkey"),
    ("E0926", "Rastamouse and the crucial plan",   "Rastamouse and the crucial plan",    None),
    ("E0927", "Wilbie finds a friend",             "Wilbie finds a friend",              None),
    ("E0928", "Toby Finds a home",                 "Toby Finds a home",                  None),
    ("E0929", "Humphreys Bedtime",                 "Humphrey's Bedtime",                 None),
    ("E0930", "100 Facts Volcanoes",               "100 Facts Volcanoes",                None),
    ("E0931", "100 Facts science",                 "100 Facts science",                  None),
    ("E0934", "The Magic of the Lost Temple",      "The Magic of the Lost Temple",       "Sudha Murthy"),
    ("E0935", "The Topsy Turvies",                 "The Topsy Turvies",                  None),
    ("E0937", "A treasury of Curious George",      "A treasury of Curious George",       None),
    ("E0940", "Dicky Duck",                        "Dicky Duck children",                None),
    ("E0941", "Oxford Reading tree Storm Castle",  "Storm Castle Oxford Reading Tree",   None),
    ("E0942", "The Donkeys Day Out",               "The Donkey's Day Out",               None),
    ("E0943", "Boy you are Awesome",               "Boy you are Awesome",                None),
    ("E0944", "Magic Bed time stories",            "Magic Bed time stories children",    None),
    ("E0945", "Disney great inventions",           "Disney great inventions",            None),
    ("E0949", "The great white man-Eating Shark",  "The great white man-Eating Shark",   None),
    ("E0959", "Zookeeper Zoe",                     "Zookeeper Zoe",                      None),
    ("E0960", "The Little Kippers collection",     "Little Kipper collection Oxford",    None),
    ("E0961", "Character building Go away",        "Character building Go away children",None),
    ("E0989", "The Rainbow Machine",               "The Rainbow Machine children",       None),
    ("E0990", "I can trick a tiger",               "I can trick a tiger",                None),
    ("E1016", "The person controller",             "The person controller David Baddiel","David Baddiel"),
    ("M0202", "Golu Gundu ani Dambu hatti",        "Golu Gundu elephant Marathi",        None),
    ("M0203", "Sinhashi Maitri",                   "Sinhashi Maitri Marathi",            None),
    ("M0204", "Billu Vikila udnyas madat karto",   "Billu Vikila Marathi Alka",          None),
    ("M0205", "Chotu Beduk",                       "Chotu Beduk frog Marathi",           None),
    ("M0206", "Milli Manjar",                      "Milli Manjar cat Marathi",           None),
    ("M0207", "Chintu Koli",                       "Chintu Koli Marathi children",       None),
    ("M0208", "Piku ani Sonu",                     "Piku ani Sonu Marathi",              None),
    ("M0209", "Radha cha Bhau",                    "Radha cha Bhau Marathi",             "Madhuri Purandare"),
    ("M0210", "Radhachi Aai",                      "Radhachi Aai Marathi",               "Madhuri Purandare"),
    ("M0211", "Chintu navacha kolha",              "Chintu navacha kolha Marathi",       None),
    ("M0212", "Hirachi Gosht",                     "Hirachi Gosht Marathi",              "Madhuri Talwalkar"),
    ("M0247", "Yash Mamachya Gavala",              "Yash Mamachya Gavala Marathi",       None),
    ("M0249", "Kevha Dr Bal Phondke",              "Kevha Dr Bal Phondke Marathi",       None),
    ("M0250", "Ka Dr Bal Phondke",                 "Ka Dr Bal Phondke Marathi",          None),
    ("M0251", "Kiti Marathi",                      "Kiti Marathi children",              None),
    ("M0252", "kase Marathi",                      "kase Marathi children",              None),
    ("M0253", "kay Marathi",                       "kay Marathi children",               None),
    ("M0254", "kon Marathi",                       "kon Marathi children",               None),
    ("M0255", "chandrala saad ghaltana",           "chandrala saad ghaltana Marathi",    None),
    ("M0256", "Awadtya Goshti",                    "Awadtya Goshti Marathi",             None),
    ("M0260", "Radhachi Aaji",                     "Radhachi Aaji Marathi",              None),
    ("M0262", "Pari Mi ani Hippopotamus",          "Pari Mi ani Hippopotamus Marathi",   None),
    ("M0265", "Laloo bokyachya goshti",            "Laloo bokyachya goshti Marathi",     None),
    ("M0271", "Radhacha Kaka",                     "Radhacha Kaka Marathi",              None),
    ("M0272", "Yash Pahuni",                       "Yash Pahuni Marathi",                None),
    ("M0273", "Radha nana",                        "Radha nana Marathi",                 None),
    ("M0297", "Radio Rescue Marathi",              "Radio Rescue Mehta Marathi",         None),
    ("M0298", "Mala Udaychay",                     "Mala Udaychay Marathi",              None),
    ("M0299", "Chaha sakhrecha natal",             "Chaha sakhrecha natal Marathi",      None),
    ("M0300", "Nav varshachi Anpekshit bhet",      "Nav varshachi Anpekshit bhet Marathi",None),
    ("M0301", "Surya Kuthe gela",                  "Surya Kuthe gela Marathi",           None),
    ("M0302", "Chatryanche Zad",                   "Chatryanche Zad Marathi",            None),
    ("M0303", "Ratriche Rakshas",                  "Ratriche Rakshas Marathi",           None),
    ("M0317", "Vikas Bodhkatha",                   "Vikas Bodhkatha Marathi",            None),
    ("M0324", "Premal Bhoot 2",                    "Premal Bhoot 2 Marathi",             None),
    ("M0325", "Premal Bhoot 3",                    "Premal Bhoot 3 Marathi",             None),
    ("M0326", "Premal Bhoot 4",                    "Premal Bhoot 4 Marathi",             None),
    ("M0327", "Haravleli Trophy",                  "Haravleli Trophy Marathi",           None),
    ("M0328", "Mazya Dhamal Goshti",               "Mazya Dhamal Goshti Marathi",        None),
    ("M0356", "Nabaad Birbalachya 205 Goshti",     "Nabaad Birbalachya 205 Goshti Marathi",None),
    ("M0359", "Sasoba ani Hasoba bhag 2",          "Sasoba ani Hasoba Marathi",          None),
    ("M0360", "Udnari Magaruli",                   "Udnari Magaruli Marathi",            None),
    ("M0361", "Shree Shivchatrapati",              "Shree Shivchatrapati Marathi",       None),
    ("M0362", "Pustak wachnare phulpakharu",       "Pustak wachnare phulpakharu Marathi",None),
    ("M0363", "Bantu cha tiktik mitra",            "Bantu cha tiktik mitra Marathi",     None),
    ("M0364", "Chakachak champu",                  "Chakachak champu Marathi",           None),
    ("M0365", "RanGit Ghotala ani Chota Jawaan",   "RanGit Ghotala Chota Jawaan Marathi",None),
    ("M0367", "Su Su Antaralveer ani Phupakharu",  "Su Su Antaralveer Phupakharu Marathi",None),
    ("M0370", "Fantastic Feluda bhag 1",           "Feluda Marathi volume 1",            None),
    ("M0371", "Fantastic Feluda bhag 2",           "Feluda Marathi volume 2",            None),
    ("M0372", "Fantastic Feluda bhag 3",           "Feluda Marathi volume 3",            None),
    ("M0373", "Fantastic Feluda bhag 4",           "Feluda Marathi volume 4",            None),
    ("M0374", "Fantastic Feluda bhag 5",           "Feluda Marathi volume 5",            None),
    ("M0375", "Fantastic Feluda bhag 6",           "Feluda Marathi volume 6",            None),
    ("M0376", "Fantastic Feluda bhag 7",           "Feluda Marathi volume 7",            None),
    ("M0377", "Fantastic Feluda bhag 8",           "Feluda Marathi volume 8",            None),
    ("M0378", "Fantastic Feluda bhag 9",           "Feluda Marathi volume 9",            None),
    ("M0379", "Fantastic Feluda bhag 10",          "Feluda Marathi volume 10",           None),
    ("M0380", "Fantastic Feluda bhag 11",          "Feluda Marathi volume 11",           None),
    ("M0381", "Fantastic Feluda bhag 12",          "Feluda Marathi volume 12",           None),
    ("M0382", "Fantastic Feluda bhag 13 to 16",    "Feluda Marathi omnibus",             None),
    ("M0383", "Fantastic Feluda bhag 17 to 19",    "Feluda Marathi omnibus",             None),
    ("M0384", "Fantastic Feluda bhag 20 to 21",    "Feluda Marathi omnibus",             None),
    ("M0385", "Fantastic Feluda bhag 22 to 24",    "Feluda Marathi omnibus",             None),
    ("M0386", "Fantastic Feluda bhag 25 to 26",    "Feluda Marathi omnibus",             None),
    ("M0387", "Fantastic Feluda bhag 27 to 29",    "Feluda Marathi omnibus",             None),
    ("M0388", "Fantastic Feluda bhag 30 to 32",    "Feluda Marathi omnibus",             None),
    ("M0421", "Sachitra Mahabharat",               "Sachitra Mahabharat Marathi",        None),
    ("M0425", "Chakachak Champu",                  "Chakachak Champu Marathi",           None),
]


def sanitize(name):
    import re
    return re.sub(r'[<>:"/\\|?*]', '', name).strip()


def is_image_file(filename):
    return filename.lower().endswith(IMAGE_EXTENSIONS)


def fetch_with_retry(url, timeout=20, retries=3):
    """Fetch a URL with retry + exponential backoff on 429 / timeouts."""
    headers = {"User-Agent": "KidsBookLibrary/1.0 (personal use)"}
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 5 * (attempt + 1)
                print(f"    429 rate-limit, waiting {wait}s…", flush=True)
                time.sleep(wait)
            else:
                print(f"    HTTP {e.code}: {e.reason}", flush=True)
                return None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2)
            else:
                print(f"    Error: {e}", flush=True)
    return None


def search_openlibrary(query):
    """Return a high-quality cover image URL from Open Library, or None."""
    params = {"q": query, "limit": 3, "fields": "cover_i,title"}
    url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode(params)
    data = fetch_with_retry(url)
    if not data:
        return None
    try:
        for doc in json.loads(data).get("docs", []):
            if "cover_i" in doc:
                return f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg"
    except Exception as e:
        print(f"    OL parse error: {e}", flush=True)
    return None


def search_google_books(query):
    """Return a high-quality cover image URL from Google Books, or None."""
    params = {"q": query, "maxResults": 1, "fields": "items(volumeInfo/imageLinks,id)"}
    url = "https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode(params)
    data = fetch_with_retry(url)
    if not data:
        return None
    try:
        items = json.loads(data).get("items", [])
        if items:
            vol = items[0]
            book_id = vol.get("id", "")
            links = vol.get("volumeInfo", {}).get("imageLinks", {})
            if book_id:
                return (f"https://books.google.com/books/content?id={book_id}"
                        f"&printsec=frontcover&img=1&zoom=0&source=gbs_api")
            for key in ("extraLarge", "large", "medium", "small", "thumbnail"):
                if key in links:
                    img_url = links[key].replace("http://", "https://")
                    return img_url.replace("zoom=1", "zoom=0").replace("zoom=2", "zoom=0")
    except Exception as e:
        print(f"    GB parse error: {e}", flush=True)
    return None


def image_dimensions(data):
    """Return (width, height) of image bytes, or (0, 0) on failure."""
    try:
        img = Image.open(io.BytesIO(data))
        return img.size  # (width, height)
    except Exception:
        return (0, 0)


def is_good_quality(data):
    """Return True if the image meets the minimum size threshold."""
    w, h = image_dimensions(data)
    return w >= MIN_W and h >= MIN_H


def is_good_quality_file(filepath):
    """Return True if an existing file on disk meets the quality threshold."""
    try:
        with open(filepath, "rb") as f:
            data = f.read()
        return is_good_quality(data)
    except Exception:
        return False


def find_existing_good_quality_file(book_no, expected_filepath):
    """Return an already-downloaded good cover for this book number, if present."""
    if os.path.exists(expected_filepath) and is_good_quality_file(expected_filepath):
        return expected_filepath

    book_prefix = f"{book_no} - ".lower()
    for fname in os.listdir(SAVE_DIR):
        if not is_image_file(fname) or not fname.lower().startswith(book_prefix):
            continue

        fpath = os.path.join(SAVE_DIR, fname)
        if is_good_quality_file(fpath):
            return fpath

    return None


def download_image(url, filepath):
    """Download image, check quality, save if good. Returns True on success."""
    data = fetch_with_retry(url, timeout=20)
    if not data or len(data) < 2000:
        return False
    if not is_good_quality(data):
        w, h = image_dimensions(data)
        with _print_lock:
            print(f"    ✗ Rejected: {w}×{h}px (min {MIN_W}×{MIN_H})", flush=True)
        return False
    with open(filepath, "wb") as f:
        f.write(data)
    return True


def purge_low_quality(directory):
    """Delete any existing image files below the quality threshold."""
    removed = []
    for fname in os.listdir(directory):
        if not is_image_file(fname):
            continue
        fpath = os.path.join(directory, fname)
        if not is_good_quality_file(fpath):
            os.remove(fpath)
            removed.append(fname)
    return removed


# ── worker ──────────────────────────────────────────────────────────────────
_print_lock = threading.Lock()

def process_book(args):
    """Download one book cover. Returns (status, book_no, display_title, detail)."""
    i, total, book_no, display_title, search_query, author = args

    filename = sanitize(f"{book_no} - {display_title}") + ".jpg"
    filepath = os.path.join(SAVE_DIR, filename)

    if not REDOWNLOAD and find_existing_good_quality_file(book_no, filepath):
        return ("skipped", book_no, display_title, "")

    with _print_lock:
        print(f"[{i}/{total}] {book_no}: {display_title}", flush=True)

    cover_url = search_openlibrary(search_query)
    source = "OpenLibrary"

    if not cover_url:
        cover_url = search_google_books(search_query)
        source = "Google Books"

    if cover_url:
        ok = download_image(cover_url, filepath)
        if ok:
            kb = os.path.getsize(filepath) // 1024
            with _print_lock:
                print(f"  ✓ {source} → {filename} ({kb} KB)", flush=True)
            return ("found", book_no, display_title, source)
        else:
            with _print_lock:
                print(f"  ✗ Image too small/missing ({source})", flush=True)
            return ("not_found", book_no, display_title, "too small")
    else:
        with _print_lock:
            print(f"  ✗ Not found on any source", flush=True)
        return ("not_found", book_no, display_title, "not found")


# ── main ────────────────────────────────────────────────────────────────────
print(f"Saving images to: {SAVE_DIR}")
print(f"Quality threshold: {MIN_W}×{MIN_H}px  |  Workers: {WORKERS}\n", flush=True)

# Step 1: purge existing low-quality images
print("Scanning for low-quality existing images…", flush=True)
removed = purge_low_quality(SAVE_DIR)
if removed:
    print(f"Removed {len(removed)} low-quality file(s):")
    for f in sorted(removed):
        print(f"  🗑  {f}")
else:
    print("  All existing images meet the quality threshold.")
print(flush=True)

print(f"Processing {len(BOOKS)} books with {WORKERS} parallel workers…\n", flush=True)

total = len(BOOKS)
work_items = [
    (i, total, book_no, display_title, search_query, author)
    for i, (book_no, display_title, search_query, author) in enumerate(BOOKS, 1)
]

found = not_found = skipped = 0
not_found_list = []

with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    futures = {pool.submit(process_book, item): item for item in work_items}
    for future in as_completed(futures):
        status, book_no, display_title, detail = future.result()
        if status == "found":
            found += 1
        elif status == "skipped":
            skipped += 1
        else:
            not_found += 1
            not_found_list.append(f"{book_no}: {display_title}")

print(f"\n{'='*60}")
print(f"Done! Downloaded: {found}  |  Already existed: {skipped}  |  Not found: {not_found}")
if not_found_list:
    print(f"\nNot found ({len(not_found_list)} books) — add manually:")
    for item in sorted(not_found_list):
        print(f"  - {item}")
