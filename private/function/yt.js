/* ###################################################################### */
const ytdl = require('ytdl-core');
const yts = require('yt-search');

/* ###################################################################### */
function getVideoId(VIDEO_URL) {
  let ID = '';
  if (ytdl.validateURL(VIDEO_URL)) {
    try {
      ID = ytdl.getURLVideoID(VIDEO_URL);
    } catch {}
  } return ID;
}

async function getStream_by_ID(VIDEO_ID, TYPE) {
  try {
    let available = false;
    let info = await ytdl.getInfo(VIDEO_ID);
    let videoFormats = ytdl.filterFormats(info.formats, TYPE);
    let countries = info.videoDetails.availableCountries;
    countries.map( (country) => {
      if (country == 'TW') available = true;
    });
    if (available) {
      return Promise.resolve({
        'title': info.videoDetails.title,
        'url': videoFormats[0].url
      });
    } else {
      return Promise.reject('Regional Restriction');
    }
  } catch {
    return Promise.reject('Invalid Format');
  }
}

async function getStream_by_URL(URL, TYPE) {
  let ID = getVideoId(URL);
  return getStream_by_ID(ID, TYPE);
}

async function getStream_by_KEYWORD(KEYWORD, TYPE) {
  const list = await yts.search(KEYWORD);
  let ID = list.videos[0].videoId;
  return getStream_by_ID(ID, TYPE)
}

/* ###################################################################### */
// const TYPE = 'audioonly';
// const KEYWORD = '点描の唄';
// const URL = 'https://www.youtube.com/watch?v=sEJKG60a1Zc';

// getStream_by_URL(URL, TYPE)
// .then( (result) => {
//   console.log(result.title);
//   console.log(result.url);
// })
// .catch( (error) => {
//   console.log(error);
// });

// getStream_by_KEYWORD(KEYWORD, TYPE)
// .then( (result) => {
//   console.log(result.title);
//   console.log(result.url);
// })
// .catch( (error) => {
//   console.log(error);
// });

/* ###################################################################### */
module.exports = {
  getStream_by_URL: getStream_by_URL,
  getStream_by_KEYWORD: getStream_by_KEYWORD
};