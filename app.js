const express = require("express");
const fetch = require("node-fetch");
const app = express();
const port = 8000;

require("dotenv").config();

app.get("/movie/random", async (req, res) => {
  const latestMovie = await requestData("movie/latest");
  const data = await getRandomMovie(latestMovie.id);
  res.json(data);
});

app.get("/tv/random", async (req, res) => {
  const latestShow = await requestData("tv/latest");
  const data = await getRandomShow(latestShow.id);
  console.log(data);
  const video = await getVideo(`${data.name} trailer ${data.release_year}`);
  res.json({ data: data, trailers: video });
});

app.get("/artist/random", async (req, res) => {
  const artist = await getRandomArtist();
  const events = await getArtistEvent(artist.name);
  res.json({ artist: artist, events: events });
});

app.listen(port, () => console.log(`http://localhost:${port}`));

async function getRandomMovie(lastMovieId) {
  let searchingMovie = true;
  let streamingData;
  while (searchingMovie) {
    const randomMovieID = Math.floor(Math.random() * lastMovieId);
    streamingData = await fetch(
      `https://utelly-tv-shows-and-movies-availability-v1.p.rapidapi.com/idlookup?source=tmdb&source_id=${randomMovieID}&country=EE`,
      {
        headers: {
          "x-rapidapi-host": process.env.X_RAPID_HOST_UTELLY,
          "x-rapidapi-key": process.env.X_RAPID_KEY_UTELLY,
          useQueryString: true,
        },
      }
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.collection.id !== undefined) {
          searchingMovie = false;
          return data;
        }
        return;
      })
      .catch((e) => console.error(e));
    if (searchingMovie) console.log("No movie with such ID:", randomMovieID);
  }
  console.log("Found valid ID:", streamingData.id);
  const streamingLocations = streamingData.collection.locations;
  const movieData = await requestData(`movie/${streamingData.id}`);
  return {
    movie_info: {
      adult: movieData.adult,
      tmdb_id: movieData.id,
      imdb_id: movieData.imdb_id,
      description: movieData.overview,
      title: movieData.title,
      status: movieData.status,
      language: movieData.language,
      release_date: movieData.release_date,
    },
    streaming_info: streamingLocations.map(
      ({ country, display_name, url, id, icon }) => ({
        country,
        streaming_icon: icon,
        streaming_name: display_name,
        url,
        utelly_id: id,
      })
    ),
  };
}

async function getRandomShow(latestShowId) {
  let searchingShow = true;
  let showData = null;
  while (searchingShow) {
    const randomShowID = Math.floor(Math.random() * latestShowId);
    showData = await requestData(`tv/${randomShowID}`);
    if (showData.name !== null) searchingShow = false;
  }
  return {
    first_air_date: showData.first_air_date,
    tmdb_id: showData.id,
    number_of_episodes: showData.number_of_episodes,
    number_of_seasons: showData.number_of_seasons,
    status: showData.status,
    in_production: showData.in_production,
    name: showData.name,
    release_year: parseInt(showData.first_air_date),
  };
}

async function getRandomArtist() {
  let artistData;
  let searchingArtist = true;
  const artistsData = await requestArtistData(
    "search?q=year:0000-9999&type=artist&market=US"
  ); // it seems it's bugged, hardcoding 1500
  while (searchingArtist) {
    console.log("Searching for artist...");
    const randomOffset = Math.floor(Math.random() * 1500); //artistsData.artists.total
    artistData = await requestArtistData(
      `search?q=year:0000-9999&type=artist&market=US&limit=1&offset=${randomOffset}`
    );
    if (artistData.error === undefined) {
      searchingArtist = false;
      artistData = artistData.artists.items[0];
    }
  }

  return {
    spotify_link: artistData.external_urls.spotify,
    followers: artistData.followers.total,
    id: artistData.id,
    name: artistData.name,
  };
}

async function getArtistEvent(name) {
  const eventData = await fetch(
    `https://api.seatgeek.com/2/events?q=${name}&client_id=${process.env.SEATGEEK_ID}&client_secret=${process.env.SEATGEEK_SECRET}`
  ).then((res) => res.json());
  return eventData.events.map(
    ({ title, id, datetime_utc, type, venue: { address }, url }) => ({
      title,
      id,
      datetime_utc,
      type,
      address,
      url,
    })
  );
}

async function requestData(url) {
  return await fetch(
    `https://api.themoviedb.org/3/${url}?api_key=${process.env.TMDB_API_KEY}`
  )
    .then((response) => response.json())
    .then((data) => {
      return data;
    })
    .catch((e) => console.error(e));
}

async function requestArtistData(url) {
  return await fetch(`https://api.spotify.com/v1/${url}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.SPOTIFY_TOKEN}`,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      return data;
    })
    .catch((e) => console.error(e));
}

async function getVideo(query) {
  return await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&order=relevance&q=${query}&type=video&videoDefinition=high&key=${process.env.GOOGLE_API_KEY}`
  )
    .then((res) => res.json())
    .then((data) => {
      return data.items.map(
        ({
          id: { videoId },
          snippet: { title, channelTitle, description },
        }) => ({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: title,
          channel: channelTitle,
          description: description,
        })
      );
    });
}
