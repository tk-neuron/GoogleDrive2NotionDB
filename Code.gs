const PROPS = PropertiesService.getScriptProperties();
const DB_ID = PROPS.getProperty('NOTION_DB_ID');
const TOKEN = PROPS.getProperty('NOTION_TOKEN');
const FOLDER_ID = PROPS.getProperty('FOLDER_ID');

const STATUS = {
  DONE: 'DONE',
  ERROR: 'ERROR',
}


function myFunction() {
  const files = getFiles()
  scanFiles(files);
}

function getFiles() {
  const targetFolder = DriveApp.getFolderById(FOLDER_ID);
  const files = targetFolder.getFiles();
  return files;
}

function getThumbnailUrl(fileId, width=1600, authuser=0){
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}?authuser=${authuser}`;
}

function scanFiles(files, nMax=500, retryMax=30) {
  let count = 0;
  let retryCount = 0;

  while (files.hasNext()) {
    let file = files.next();
    const status = file.getDescription();

    if (count == nMax | retryCount == retryMax) {
      break;
    }

    if (status == STATUS.DONE | status == STATUS.ERROR) {
      continue;
    }

    const filename = file.getName();
    const url = file.getUrl();
    const [journal, firstAuthor, lastAuthor, year, title] = filename.split('_');
    const thumbnailURL = getThumbnailUrl(file.getId());

    try {
      const result = {
        title: title.split('.pdf')[0],
        url: url,
        journal: journal,
        firstAuthor: firstAuthor,
        lastAuthor: lastAuthor,
        year: year,
        thumbnailURL: thumbnailURL,
      };
      send2Notion(result);
      file.setDescription(STATUS.DONE);
      Logger.log(`upload to Notion succeeded: ${filename}`);
      count ++;
    } 
    catch (e) {
      file.setDescription(STATUS.ERROR);
      Logger.log(e.message);
      Logger.log(`upload to Notion failed: ${filename}`);
      retryCount ++;
    }
  }
}

function send2Notion(result) {
  const apiUrl = 'https://api.notion.com/v1/pages';
  const obj = generateObj(DB_ID, result);
  const options = {
    method: "POST",
    headers: {
      "Content-type": "application/json",
      "Authorization": "Bearer " + TOKEN,
      "Notion-Version": '2021-08-16',
    },
    payload: JSON.stringify(obj),
  };
  UrlFetchApp.fetch(apiUrl, options);
}

function generateObj(dbId, result) {
  const pageObj = {
    parent: {
      database_id: dbId,
    },
    cover: {
        "type": "external",
        "external": {
            "url": result.thumbnailURL
        }
    },
    properties: {
      "Name": {
        "title": [{
          "text": {
            "content": result.title
          }
        }]
      },
      "URL": {
        "url": result.url
      },
      "Author": {
        "multi_select": [
          {
            "name": result.firstAuthor,
          },
          {
            "name": result.lastAuthor,
          }
        ]
      },
      "Year": {
        "type": "number",
        "number": parseInt(result.year),
      },
      "Journal": {
        "type": "select",
        "select": {
          "name": (result.journal.length > 0) ? result.journal: 'Others'
        }
      }
    }
  }
  return pageObj;
}

