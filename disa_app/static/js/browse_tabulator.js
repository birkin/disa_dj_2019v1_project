
(function() { // Open IIFE

  // Constants

  const DATA_ENDPOINT_URL = document.getElementById('denormalized_json_url').value,
        NAME_DISPLAY_OVERRIDES = {
          'unrecorded': 'No name is recorded ',
          'Unknown': 'No name is known '
        },
        BIO_THEME_CLASSNAME = 'biographical',
        VIEW_OPTIONS_RADIO_BUTTONS_ID = 'view-options',
        MIN_TIME_BETWEEN_LUNR_INDEXES = 1000;

  // Event handlers

  window.disa = {};

  window.populateTribeFilter = function(tribeName) {
    window.table.setHeaderFilterValue('description.tribe', tribeName);
  }

  window.populateNameFilter = function(nameSearchText) {
    window.table.setHeaderFilterValue('all_name', nameSearchText);
  }

  window.populateLocationFilter = function(locationSearchText) {
    window.table.setHeaderFilterValue('all_locations', locationSearchText);
  }

  // Called when "details" button pressed

  let detailsModal;

  window.showDetails = function(id) {

    const data = window.disa.jsonData.find(x => x.id === id);

    // Initialize modal

    function getModalContentSetter(idOrClass, textOrHTML) {
      const elems = document.querySelectorAll(`#${idOrClass},.${idOrClass}`);
      return function(content) {
        elems.forEach(elem => elem[`inner${textOrHTML}`] = content);
      }
    }

    const setDetailsTable = getModalContentSetter('details-table', 'HTML');

    if (detailsModal === undefined) {
      detailsModal = {
        show: () => $('#details-modal').modal('show'),
        setId: getModalContentSetter('details-id', 'Text'),
        setName: getModalContentSetter('details-title-name', 'Text'),
        setDocTitle: getModalContentSetter('details-doc', 'Text'),
        setTranscription: getModalContentSetter('details-transcription', 'HTML'),
        clearDetailsTable: () => setDetailsTable(''),
        addToDetailsTable: (label, value) => {
          document.getElementById('details-table').innerHTML +=
            `<tr><th>${label}</th><td>${value}</td></tr>`;
        }
      }
    }

    // Populate modal

    if (data) {
      detailsModal.setName(data.all_name);
      detailsModal.setId(id);
      // detailsModal.transcription(data.comments.replace(/http[^\s]+/,''));
      detailsModal.setTranscription(data.comments);
      detailsModal.setDocTitle(data.docTitle.replace(/http[^\s]+/,''));
      detailsModal.clearDetailsTable();

      const detailsTableContent = [
        ['Location', data.all_locations],
        ['First name', data.first_name],
        ['Last name', data.last_name],
        ['Role(s)', data.roles],
        ['Date', new Date(data.date.year, data.date.month, data.date.day).toDateString()],
        ['Tribe', data.description.tribe],
        ['Sex', data.description.sex],
        ['Origin', data.description.origin],
        ['Vocation', data.description.vocation],
        ['Age', data.age],
        ['Has a father?', data.has_father],
        ['Has a mother?', data.has_mother],
        ['Owner', data.owner],
        ['Spouse', data.spouse]
      ];

      detailsTableContent.forEach(
        ([label, value]) => {
          if (value) { 
            detailsModal.addToDetailsTable(label, value) 
          }
        }
      );

      detailsModal.show();
    }
  }

  // Global functions

  // Toggle special characters (single/double quotes; ampersand)
  //  with special codes
  // WARNING: don't use with transcription

  const ampersandRegex = /&(?!\w+;)/,
        aposRegEx = /'/g,
        quotRegEx = /"/g,
        aposRegEx_reverse = /\[APOS]/g,
        quotRegEx_reverse = /\[QUOT]/g,
        ampersandRegex_reverse = /\[AMP]/g;

  function cleanString(str) {
    return str.replace(aposRegEx, '[APOS]')
              .replace(quotRegEx, '[QUOT]')
              .replace(ampersandRegex, '[AMP]');
  }

  function uncleanString(str) {
    return str.replace(aposRegEx_reverse, "'")
              .replace(quotRegEx_reverse, '"')
              .replace(ampersandRegex_reverse, '&amp;');
  }

  // Lunr index function

  let lunrIndex, currLunrSelection;

  function indexInLunr(data) {

    // Create a list of documents with ID
    //   and text (which combines all the DISA fields to search)

    const docList = data.map(entry => {

      const indexableText = [
        entry.first_name, entry.last_name,
        entry.comments, Object.keys(entry.documents).join(' '),
        entry.locations.join(' '),
        Object.values(entry.description).join(' ')
      ].join(' ');

      const indexableText_noHTML = indexableText.replace(/\<[^>]+>/g, '');

      return {
        id: entry.id,
        text: indexableText_noHTML
      }
    });

    // Create lunr index from the documents

    const index = lunr( function () {
      this.ref('id');
      this.field('text');

      docList.forEach(function (document) {
        this.add(document)
      }, this);
    });

    return index;
  }

  // Main onload routine

  window.addEventListener('DOMContentLoaded', () => {

    // General search box listener
    //   When user inputs something, trigger a re-indexing

    document.getElementById('general-search')
            .addEventListener('input', searchAgainstIndex);

    // Run the JSON through this when it comes back from the
    //  server. Save the data.

    const jsonProcessor = function(_, __, response) {

      console.log('JSON response', response);

      // Create an 'all_names' field
      // Create an 'all_locations' field
      // Clean up data for apostrophes, ampersands

      response.forEach(entry => {

        // Name

        entry.first_name = cleanString(entry.first_name);
        entry.last_name = cleanString(entry.last_name);

        entry.all_name = [entry.first_name, entry.last_name]
                          .filter(name => (name))
                          .join(' ');
        // Location

        const docWithLocation = Object.values(entry.documents)[0]
          .find(doc => doc.locations && doc.locations.length);

        entry.locations = docWithLocation
          ? docWithLocation.locations.map(loc => cleanString(loc))
          : [];
        // console.log('AFTER', entry.locations);
        entry.all_locations = entry.locations.join(', ');

        // Doc

        entry.docTitle = Object.keys(entry.documents)[0];
        entry.docTitle = cleanString(entry.docTitle);
        entry.comments = entry.comments.replace(/ style="[^"]*"/g,'');
        entry.commentsNoHTML = entry.comments.replaceAll(/<[^>]+>/g,'');

        // Roles

        const nonUniqueRoles = Object.values(entry.documents)
                            .map(doc => Object.keys(doc[0].roles))
                            .reduce((acc, docKeysArr) => acc.concat(docKeysArr));

        entry.roles = Array.from(new Set(nonUniqueRoles)).join(', ');

        function includesAny(compareArr1, compareArr2) {
          return compareArr1.reduce(
            (acc, role) => acc || compareArr2.includes(role), 
            false
          );
        }

        const enslavedRoles = ['Enslaved','Bought','Sold','Shipped','Arrived','Escaped','Captured','Emancipated'],
              enslaverRoles = ['Owner','Captor','Buyer','Seller','Master'];

        if (includesAny(nonUniqueRoles, enslavedRoles)) {
          entry.status = 'Enslaved';
        } else if (includesAny(nonUniqueRoles, enslaverRoles)) {
          entry.status = 'Enslaver';
        } else {
          entry.status = 'Neither';
        }
      });

      // Index this in Lunr

      lunrIndex = indexInLunr(response);
      window.disa.lunrIndex = lunrIndex; // For testing
      searchAgainstIndex(); // Initialize results array for general search

      // Save this data for later & return to Tabulator

      window.disa.jsonData = response;
      return response;
    }

    // Given a row of data, create a biographical sketch in HTML

    const getPersonEntryHTML = function(data) {

      const nameDisplay = NAME_DISPLAY_OVERRIDES[data.first_name] || data.first_name,
            name_text = data.description.title
                        + `<a href="#" onclick="populateNameFilter('${nameDisplay}')" title="Show only people named '${nameDisplay}'">${uncleanString(nameDisplay)}</a>`
                        + (data.last_name ? ` <a href="#" onclick="populateNameFilter('${data.last_name}')" title="Show only people with last name '${data.last_name}'">${uncleanString(data.last_name)}</a>` : ''),
            name_forOrIs = NAME_DISPLAY_OVERRIDES[data.first_name] ? 'for' : 'is',
            statusDisplay = {
              'Enslaved': 'enslaved',
              'Enslaver': 'slave-owning',
              'Neither': ''
            },
            locSearchTerms = data.locations.map((_, i, locArr) => locArr.slice(i).join(', ')),
            locationDisplay = data.locations.map((loc, i) => {
              return `<a  href="#" onclick="populateLocationFilter('${locSearchTerms[i]}')"
                          title="Show only people located in ${locSearchTerms[i]}">${uncleanString(loc)}</a>`
            }).join(', '),
            sexDisplay = {
              'child': {
                'Female' : 'girl',
                'Male': 'boy',
                'Other': 'child',
                '': 'child'
              },
              'adult': {
                'Female': 'woman',
                'Male': 'man',
                'Other': 'person',
                '': 'person'
              }
            },
            ageAsNumber = parseInt(data.description.age),
            age_number = (isNaN(ageAsNumber) ? undefined : ageAsNumber),
            ageStatus = (age_number && age_number <= 16 ? 'child' : 'adult'),
            age_text = (data.description.age === 'Not Mentioned' ? undefined : data.description.age),
            race_text = (data.description.race ? `, described as &ldquo;${data.description.race}&rdquo;,` : ''),
            year = data.date.year;

      const html = `<a  class="details-button float-right" onclick="showDetails(${data.id})"
                        title="Show source document and details for ${data.all_name}">Details</a>` +
                   `<strong class='referent-name'>${name_text}</strong> ${name_forOrIs} ` +
                   (statusDisplay[data.status][0] === 'e' ? 'an ' : 'a ') +
                   statusDisplay[data.status] + ' ' +
                   // (data.description.tribe ? ` <a href="#" title="Show only ${data.description.tribe} people" data-filter-function='populateTribeFilter' data-filter-arg="${data.description.tribe}" onclick="populateTribeFilter('${data.description.tribe}')">${data.description.tribe}</a> ` : '') +
                   (data.description.tribe ? ` <a href="#" title="Show only ${data.description.tribe} people" data-filter-function='populateTribeFilter' data-filter-arg="${data.description.tribe}">${data.description.tribe}</a> ` : '') +
                   sexDisplay[ageStatus][data.description.sex] +
                   (age_text ? `, age ${age_text}` : '') +
                   race_text +
                   ' who lived' +
                   ` in ${locationDisplay}` +
                   (year ? ` in ${year}` : '') +
                   '.';
      return html;
    }

    const rowFormatter = function(row) {
      var data = row.getData();
      row.getElement().innerHTML = getPersonEntryHTML(data);
    };

    const generateDropDownOptions = function(data, selectorFn) {
      const values = data.map(x => selectorFn(x)),
            uniqueValues = Array.from(new Set(values));
      return uniqueValues.keys();
    }
  
    const columnDefinitions = [
      { title:'Name',      field:'all_name',          sorter:'string', headerFilter: true }, // mutator: combineNames_mutator },
      { title:'Last name', field:'last_name',         sorter:'string', headerFilter: true, visible: false },
      { title:'Status',    field:'status',            sorter:'string', headerFilter: true,
        headerFilter: 'select', headerFilterParams:{ values: ['Enslaved','Enslaver','Neither'] } },
      // { title:'Roles',    field:'roles',              sorter:'string', headerFilter: true },
      { title:'Sex',       field:'description.sex',   sorter:'string',
        headerFilter: 'select', headerFilterParams:{ values: ['Male','Female', 'Other'] } },
      { title:'Tribe',     field:'description.tribe', sorter:'string',
        headerFilter: 'select', 
        headerFilterParams: { 
          values: [ "\"daughter of a Spanish Squaw\"", "Apalachee", "Blanco", "Blanea", "Bocotora", 
                    "Bousora", "Boustora", "Chaliba", "Cherokee", "Codira", "Cookra", "Creek", 
                    "Cuol", "Curero", "Eastern Pequot", "Eastern Tribes", "Mashantucket Pequot", 
                    "Mohegan", "Naragansett", "Natchez", "Nidwa", "Nipmuc", "Noleva", "Nome Lackee", 
                    "Nomi Lackee", "Oquelonex", "Pequot", "Portoback", "Rocotora", "Sambo", "Shaliba", 
                    "Shalliba", "Shangina", "Shargana", "Shatyana", "Souix,Sioux", "Spanish", "Talusky", 
                    "Tanybec", "Tenebec", "Tenybec", "Terriby", "Thalliba", "Toluskey", "Unspecified", 
                    "Valiante", "Valience", "Wackaway", "Wampanoag", "Warao", "Weanoke,Weanock,Powhatan", 
                    "Weyanoke", "Woolwa", "de Nacion Caribe Cuchibero" ]
        } 
      },
      { title:'Race',      field:'description.race',  sorter:'string', 
        headerFilter: 'select', 
        headerFilterParams: { 
          values: [ "Asiatic", "Black", "Carolina Indian", "Creole", "Creole", "Dark melattress", 
                    "Dark mulatto", "East India Negro", "East-India Indian", "East-Indian", "Griffon", 
                    "Half Indian", "Half Indian", "Half Negro", "Indian", "Indian Mulatto", "Irish", 
                    "Martha's Vineyard Indian", "Mulatto", "Mustee", "Negro", "Sambo", "Spanish Indian", 
                    "Surinam Indian", "White" ]
        }
      },
      // { title:'Age',       field:'description.age',   sorter:'string', headerFilter: true },
      { title:'Location',  field:'all_locations',     sorter:'string', headerFilter: true },
      { title:'Year',      field:'date.year',         sorter:'string', headerFilter: true },
      { title:'Source transcription', field:'commentsNoHTML', visible: false, download: true }
    ];

    const rowClick = function(_, row) {
      showDetails(row.getData().id);
    };

    const doFilter = function(e) {
      const funcName = e.target.getAttribute('data-filter-function'),
            funcArg = e.target.getAttribute('data-filter-arg');
      
    }

    const tabulatorOptions_global = {
      height:'611px',
      layout:'fitColumns',
      placeholder:'No records match these criteria<br />Try removing filters to broaden your search',
      pagination: 'local',
      paginationSize: 20,
      paginationSizeSelector:[20,50,100],
      columns: columnDefinitions,
      renderComplete: () => {
        console.log('RENDER COMPLETE');
        document.querySelectorAll("*[data-filter-function]").forEach(
          x => {
            // const onclickFunction = () => window[x.getAttribute('data-filter-function')](x.getAttribute('data-filter-arg'));
            const onclickFunctionName = x.getAttribute('data-filter-function'),
                  onclickFunctionArg = x.getAttribute('data-filter-arg'),
                  onclickFunction = () => window[onclickFunctionName](onclickFunctionArg);
            x.addEventListener('click', onclickFunction, true);
          }
        )
      }
      //groupBy:'status'
    }

    const tabulatorOptions_init = Object.assign(
      [], 
      tabulatorOptions_global, 
      {
        ajaxURL: DATA_ENDPOINT_URL,
        ajaxResponse: jsonProcessor,
        rowFormatter: rowFormatter
      }
    );

    let table = new Tabulator('#data-display', tabulatorOptions_init);

    table.addFilter(data => {
      return currLunrSelection.includes(data.id);
    });

    // Listener for the biographical/tabular view selector

    const bioViewOptionInputElem = document.getElementById('biographical-view-option'),
          tableContainer = document.getElementById('data-display');

    document.getElementById(VIEW_OPTIONS_RADIO_BUTTONS_ID).addEventListener('click', () => {

      const bioOption = bioViewOptionInputElem.checked;

      const tabulatorOptions_view = bioOption 
        ? { rowFormatter } 
        : { rowClick };

      const tabulatorOptions_dataLoaded = {
        data: window.disa.jsonData
      }

      table.destroy();
      tableContainer.classList.toggle(BIO_THEME_CLASSNAME, bioOption);

      let t = document.getElementById('data-display');

      table = new Tabulator(
        '#data-display',
        Object.assign({}, 
          tabulatorOptions_global, 
          tabulatorOptions_dataLoaded,
          tabulatorOptions_view
        ) 
      );

      table.addFilter(data => {
        return currLunrSelection.includes(data.id);
      });

      window.table = table;
    });

    window.table = table;

    document.getElementById('download-data')
            .addEventListener('click', () => window.table.download('csv', `disa-data-export_${Date.now()}.csv`));

    // This is called every time a user changes the content of the
    //   general search box

    let lastSearchTimestamp = 0, timeOutId;
    const generalSearchInput = document.getElementById('general-search');

    function searchAgainstIndex(x) {

      const searchTextChanged = (x !== false);

      // If enough time has passed ...

      if (Date.now() - lastSearchTimestamp > MIN_TIME_BETWEEN_LUNR_INDEXES) {

        // Do a search against index & force Tabulator to reapply filters

        currLunrSelection = lunrIndex.search(generalSearchInput.value).map(x => parseInt(x.ref));
        console.log(`Searching for ${generalSearchInput.value}`, 'Results:', currLunrSelection);
        table.setFilter(table.getFilters());

        // Update times

        lastSearchTimestamp = Date.now();

        // If this update is becuase of a change in the
        //   search field, then schedule a future
        //   search to catch any changes

        if (searchTextChanged) {
          window.clearTimeout(timeOutId);
          timeOutId = window.setTimeout(
            () => { searchAgainstIndex(false) },
            MIN_TIME_BETWEEN_LUNR_INDEXES + 100
          );
        }
      }
    }
  });

})() // Closing IIFE
