var cheerio = require('cheerio')
var got = require('got')

module.exports = ScrapeEngine

function ScrapeEngine () {
  if (!(this instanceof ScrapeEngine)) {
    return new ScrapeEngine()
  }

  this.lastfmURL = 'http://www.last.fm'
  // Two step selection
  // var selection = $('.col-main h2:contains(\'Artist\')').parent()
  // $(selection).find('ol.grid-items .grid-items-item a.link-block-target')
  this.filter = [
    '.col-main  ol.grid-items .grid-items-item a.link-block-target ', // Target: Artist 2step
    '.col-main h2:contains(\'Album\')', // Target: Album 2step
    '.chartlist .chartlist-name a.link-block-target', // Target: Titles
    '.col-main .grid-items-section .grid-items-item-main-text a.link-block-target', // Similar Artist 2Step
    '.col-main .grid-items a.link-block-target', // Similar Artist over "+similar" URL
    // ----------------------------------------------------------------------------//
    '.col-main .grid-items-section .grid-items-item-main-text a.link-block-target', // Similar Titles
    '.header-tags a', // Genre: Artist, Title, Album
    '.col-main .grid-items-section .grid-items-item-main-text a.link-block-target', // Tag: Top Artists 2Step
    '.col-main .grid-items-section .grid-items-item-main-text a.link-block-target', // Tag: Top Albums 2Step
    '.chartlist .chartlist-name a.link-block-target', // Tag: Top Titles
    // ----------------------------------------------------------------------------//
    '.col-main .grid-items-section .grid-items-item-main-text a.link-block-target', // Tag: Artists
    '.album-grid .album-grid-item>a', // Tag: Albums, content: el.find('p').text()
    '.chartlist .chartlist-name a.link-block-target', // Tag: Title
    '.header-crumb', // Title, Album: Artist
    '.primary-album .metadata-display a', // Title: Album
    // ----------------------------------------------------------------------------//
    'li.tag a', // Title: Genre
    '.header-avatar img', // Album: Cover, href: el.attr('src'), content: el.attr('alt')
    '.page-content h1' // Error 404
  ]
}

// Get the cover of an album as a base64 encoded JSON
ScrapeEngine.prototype.getCover = function (album, artist, callback) {
  this.getCoverURL(album, artist, function (err, coverURL) {
    if (err) {
      callback(err, coverURL)
      return
    }
    // Get the the binary of the cover without encoding
    got(coverURL, {encoding: null}, function (err, data) {
      if (err) {
        callback(err, data)
        return
      }

      var base64 = new Buffer(data, 'binary').toString('base64')
      callback(err, base64)
    })
  })
}

// Get the url of an album cover
ScrapeEngine.prototype.getCoverURL = function (album, artist, callback) {
  var self = this
  this.getURLAlbum(album, artist, function (err, albumURL) {
    if (err) {
      callback(err, albumURL)
      return
    }

    var url = self.lastfmURL + albumURL
    // Get the page of the album
    got(url, function (err, html) {
      if (err) {
        callback(err, html)
        return
      }

      var $ = cheerio.load(html)
      // Push the url and alt of the img into list
      var list = $(self.filter[16]).map(function (i, el) {
        el = $(el)
        var img = {
          src: el.attr('src'),
          content: el.attr('alt')
        }
        console.log(img)
        return img
      }).get()
      callback(err, list[0].src)
    })
  })
}

// Get the url of an specific album
ScrapeEngine.prototype.getURLAlbum = function (album, artist, callback) {
  var self = this
  var list = []
  // Get the search page with the specified data
  got(this.createQueryURL(artist, album), function (err, html) {
    if (err) {
      callback(err, html)
      return
    }

    var $ = cheerio.load(html)
    // Push the found result into list
    $(self.filter[1]).parent().find('ol.grid-items .grid-items-item a.link-block-target').map(function (i, el) {
      el = $(el)
      var row = {
        href: el.attr('href'),
        content: el.text()
      }
      console.log(row)
      list.push(row)
    })
    callback(err, list[0].href)
  })
}

// Get a list of object, which contains similar artist information and the url
ScrapeEngine.prototype.getSimilarArtist = function (artist, callback) {
  var self = this
  this.getURLArtist(artist, function (err, artistURL) {
    if (err) {
      callback(err, artistURL)
      return
    }

    var url = self.lastfmURL + artistURL + '/+similar'
    console.log(url)
    // Get the similar page of a specified artist
    got(url, function (err, html) {
      if (err) {
        callback(err, html)
        return
      }

      var $ = cheerio.load(html)
      // Push the similar artists into list
      var list = $(self.filter[4]).map(function (i, el) {
        el = $(el)
        var row = {
          href: el.attr('href'),
          content: el.text()
        }
        console.log(row)
        return row
      }).get()
      callback(err, list)
    })
  })
}

// Get the url of a specific artist
ScrapeEngine.prototype.getURLArtist = function (artist, callback) {
  var self = this
  var list = []
  // Get the search page with the specified data
  got(this.createQueryURL(artist), function (err, html) {
    if (err) {
      callback(err, html)
      return
    }

    var $ = cheerio.load(html)
    // Push the found result into list
    $(self.filter[0]).map(function (i, el) {
      el = $(el)
      var row = {
        href: el.attr('href'),
        content: el.text()
      }
      console.log(row)
      list.push(row)
    })
    callback(err, list[0].href)
  })
}

// Get the metadata of title
ScrapeEngine.prototype.getMetadata = function (list, result, callback) {
  var self = this
  var url = self.lastfmURL + list[result.length].href
  console.log('URL: ' + url)
  // Get the page of the title
  got(url, function (err, html) {
    if (err) {
      callback(err, html)
      return
    }
    var $ = cheerio.load(html)
    var metadata = {}
    // Collect all desired metadata
    metadata.artist = $(self.filter[13]).text()
    metadata.album = $(self.filter[14]).text()
    metadata.title = list[result.length].content
    metadata.genre = $(self.filter[15]).first().text()
    result.push(metadata)
    console.log('Metadata: ' + metadata)

    // Run again till we iterated through the whole list
    if (list.length !== result.length) {
      self.getMetadata(list, result, callback)
    } else {
      callback(err, result)
    }
  })
}

// Get a list of object, which contains similar title information and the url
ScrapeEngine.prototype.getSimilarTitle = function (title, album, artist, genre, callback) {
  var self = this
  var result = []
  var url = ''

  // Get similar title by genre
  if (genre !== undefined || genre !== '' || title === undefined || title === '' || album === '' || artist === '') {
    // Get the tag page
    url = self.lastfmURL + '/tag/' + encodeURI(genre)
    console.log(url)
    got(url, function (err, html) {
      if (err) {
        callback(err, html)
        return
      }

      var $ = cheerio.load(html)
      // Error 404: If Page not found
      try {
        if ($('.page-content h1').text() === '404 - Page Not Found') throw 'Error: 404'
      } catch (err) {
        callback(err, html)
      }
      // Push the links of the similar title into list
      var list = $(self.filter[9]).map(function (i, el) {
        el = $(el)
        var row = {
          href: el.attr('href'),
          content: el.text()
        }
        console.log(row)
        return row
      }).get()
      self.getMetadata(list, result, callback)
    })
    return
  }

  // Get similar title by artist
  if (title === undefined || title === '' || album === '' || artist !== '') {
    // Get the URL of artist
    this.getURLArtist(artist, function (err, artistURL) {
      if (err) {
        callback(err, artistURL)
        return
      }

      url = self.lastfmURL + artistURL
      console.log(url)
      // Get the artist page
      got(url, function (err, html) {
        if (err) {
          callback(err, html)
          return
        }

        var $ = cheerio.load(html)
        // Push the links of the top title into list
        var list = $(self.filter[9]).map(function (i, el) {
          el = $(el)
          var row = {
            href: el.attr('href'),
            content: el.text()
          }
          console.log(row)
          return row
        }).get()
        // Take the first entry in list as target
        url = self.lastfmURL + list[0].href
        // Get the page of the specified title
        got(url, function (err, html) {
          if (err) {
            callback(err, html)
            return
          }
          var $ = cheerio.load(html)
          // Push similar title of the given title into list
          var list = $(self.filter[5]).map(function (i, el) {
            el = $(el)
            var row = {
              href: el.attr('href'),
              content: el.text()
            }
            console.log(row)
            return row
          }).get()
          self.getMetadata(list, result, callback)
        })
      })
    })
    return
  }

  // Get similar title by artist and album
  if (title === undefined || title === '' || album !== '' || artist !== '') {
    this.getURLAlbum(album, artist, function (err, albumURL) {
      if (err) {
        callback(err, albumURL)
        return
      }
      url = self.lastfmURL + albumURL
      // Get the page of the album
      got(url, function (err, html) {
        if (err) {
          callback(err, html)
          return
        }

        var $ = cheerio.load(html)
        // Push the titles of the album into list
        var list = $(self.filter[2]).map(function (i, el) {
          el = $(el)
          var row = {
            href: el.attr('href'),
            content: el.text()
          }
          console.log(row)
          return row
        }).get()
        // Take the first entry in list as target
        url = self.lastfmURL + list[0].href
        // Get the page of the specified title
        got(url, function (err, html) {
          if (err) {
            callback(err, html)
            return
          }

          var $ = cheerio.load(html)
          // Push similar title of the given title into list
          var list = $(self.filter[5]).map(function (i, el) {
            el = $(el)
            var row = {
              href: el.attr('href'),
              content: el.text()
            }
            console.log(row)
            return row
          }).get()
          self.getMetadata(list, result, callback)
        })
      })
    })
    return
  }

  // Get similar title by title, artist and album
  this.getURLTitle(title, album, artist, function (err, titleURL) {
    if (err) {
      callback(err, titleURL)
      return
    }

    var url = self.lastfmURL + titleURL
    // Get the page of the title
    got(url, function (err, html) {
      if (err) {
        callback(err, html)
        return
      }

      var $ = cheerio.load(html)
      // Push similar title of the given title into list
      var list = $(self.filter[5]).map(function (i, el) {
        el = $(el)
        var row = {
          href: el.attr('href'),
          content: el.text()
        }
        console.log(row)
        return row
      }).get()
      self.getMetadata(list, result, callback)
    })
  })
}

// Get the url of a specific title
ScrapeEngine.prototype.getURLTitle = function (title, album, artist, callback) {
  var self = this
  var list = []
  // Get the search page with the specified data
  got(this.createQueryURL(artist, album, title), function (err, html) {
    if (err) {
      callback(err, html)
      return
    }

    var $ = cheerio.load(html)
    // Push the result into list
    $(self.filter[2]).map(function (i, el) {
      el = $(el)
      var row = {
        href: el.attr('href'),
        content: el.text()
      }
      console.log(row)
      list.push(row)
    })
    callback(err, list[0].href)
  })
}

// Creates an query url with the passed metadata
ScrapeEngine.prototype.createQueryURL = function (artist, album, title) {
  var result = this.lastfmURL + '/search?q='
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i]) {
      result += encodeURI(arguments[i])
    }
  }
  console.log(result)
  return result
}
