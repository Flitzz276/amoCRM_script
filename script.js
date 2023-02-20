
// Токен действителен до 8 марта
const access_token = 'a8a6d286cf83ee4afc5747b6ecae70f7e8c442deb1d96c222c93d855bdcc8c7cc35e5dfe7269b97fd4a16128a9a23beff931b4365878e5115c24a73c8c248578d9a59335f79732ac504a3ccbddb173afba4b59e63b86f3898b7259e84800b952e2eb79d943e03378d32762502cf30f91260ec8b486e14e96a731a59ea0a624f88cfe05ce0fc0ddc390d722a9e1625b6a3f5d6218c5b5ea2590560a984e1e8f4ff3d71ecb72a15d6dcd8441adf770c96573fc73f173fb451a646f536498eb199430db2af549493a660d70ce7d12ab08cfec35aab978bcbc983feaea86daa058e06dea3667bec1c77fe45288b2d55067b8d92341e809d5cdff0abe7788030a0dacf2ec61080154a66a67e349d505a80aed1e86a78eabd80b42decd2e36528356f13da867786db639c8e5433035be44169359f8e6f822bbb1a416ebd05f2a376ed58db90db2cf225b40b6c32cd62d506664b613f1b3a0da11845de4b49a916928344bea9afb58b0ea9b5acce6cd1b9e1a7839bae917a55df29f553cbc837317c13be156cb04548d621d45974bf371c91c966410ebd2fb5424c1e175c8a1906a1dc0f5d8a889091be156cb04548d621d45974bf371';

const taskName = 'Контакт без сделок';

const hostAddr = 'https://flitzz276.amocrm.ru';
const tasksCreateUrl = '/api/v4/tasks';

const limit = 25;

let page = 1;

let getContactsListQueryUrl = '/api/v4/contacts?order[id]=asc';

let tasksContactsQueryUrl = '/api/v4/tasks?filter[task_type]=1&filter[is_completed]=0&filter[entity_type]=contacts';

// Метаданные 
let ajaxCrossDomainCallers = {
  // Получение списка контактов
  getContacts: {
    url: getContactsListQueryUrl,
    method: 'GET',
    
    done: getContactsDone,

    fail: getContactsFail
  },

  // Обработка  списка контактов
  parseContacts: {
    url: tasksContactsQueryUrl,
    method: 'GET',
    done: parseContactsDone,
    fail: parseContactsFail
  },

  createTasksWithContacts: {
    url: tasksCreateUrl,
    method: 'POST',
    done: createTasksWithContactsDone,
    fail: createTasksWithContactsFail
  }
};

// Создание кросс-доменных AJAX-запросов
function ajaxCrossDomainCall(callerName, ajaxData) {
  if (callerName in ajaxCrossDomainCallers) {
    let ajaxCaller = ajaxCrossDomainCallers[callerName];
    let doneFn = ajaxCaller.done;
    let failFn = ajaxCaller.fail;

    if (typeof ajaxData !== 'string' && 'filter[entity_id]' in ajaxData) {
      doneFn = function(data) {
        ajaxCaller.done(data, ajaxData['filter[entity_id]']);
      }
    }

    $.ajax({
      crossDomain: true,
      url: hostAddr + ajaxCaller.url,
      method: ajaxCaller.method,
      data: ajaxData,
      dataType: 'json',
      headers: {
        Authorization: 'Bearer ' + access_token
      }
    }).done(doneFn).fail(failFn);
  }
}

// Получение списка контактов 
function getContacts() {
  ajaxCrossDomainCall('getContacts', {
    limit: limit,
    page: page,
    with: 'leads'
  });

  page++;
}

// Обработка полученных данных
function getContactsDone(data) {
  if (!!data) {
    parseContacts(data._embedded.contacts);

    getContacts();
  } else {
    console.log('Контактов нет');
    return false;
  }
}

function getContactsFail(data) {
  console.log('Что-то пошло не так c получением контактов', data);
  return false;
}

// Обработка массива контактов
function parseContacts(contacts) {
  let contactsWithoutLeads = getContactsWithoutLeads(contacts);

  if (!contactsWithoutLeads.length) {
    return false;
  }

  ajaxCrossDomainCall('parseContacts', {
    'filter[entity_id]': contactsWithoutLeads
  });
}

// Обработка полученных данных о задачах 
function parseContactsDone(data, contactsWithoutLeads) {
  if (!!data) {
    data._embedded.tasks.forEach(task => {
      if (task.text === taskName) {
        let contactIdx = contactsWithoutLeads.indexOf(task.entity_id);
        if (contactIdx > -1) {
          contactsWithoutLeads.splice(contactIdx, 1);
        }
      }
    });
  }
  createTasksWithContacts(contactsWithoutLeads);
}

function parseContactsFail(data) {
  console.log('Что-то пошло не так с поиском связанных задач', data);
  return false;
}

// Пакетное создание задач, связанных с контактами
function createTasksWithContacts(contactsWithoutLeads) {
  let tasksToCreate = getTasksToCreate(contactsWithoutLeads);

  if (!tasksToCreate.length) {
    return false;
  }

  // Создание задачи для контактов
  ajaxCrossDomainCall('createTasksWithContacts', '[' + tasksToCreate.join(",") + ']');
}

// Обработка запроса на создание задач
function createTasksWithContactsDone(data) {
  console.log('Новые задачи были созданы', data);
}

function createTasksWithContactsFail(data) {
  console.log('Что-то пошло не так с попыткой создать новые задачи', data);
  return false;
}

// Получение массив ID контактов без сделок
function getContactsWithoutLeads(contacts) {
  let contactsWithoutLeads = [];

  contacts.forEach(contact => {
    if (!contact._embedded.leads.length) {
      contactsWithoutLeads.push(contact.id);
    }
  });

  return contactsWithoutLeads;
}

// Получение массива задач для создания
function getTasksToCreate(contactsWithoutLeads) {

  let tasksToCreate = [];

  let completeTillUnixTimestamp = Math.floor(Date.now() / 1000 + 7 * 86400);
  contactsWithoutLeads.forEach(contactID => {
    tasksToCreate.push(
      JSON.stringify({
        entity_id: contactID,
        entity_type: 'contacts',
        text: taskName,
        complete_till: completeTillUnixTimestamp,
        task_type_id: 1
      })
    );
  });
  
  return tasksToCreate;
}

$(document).ready(function(){
  $('#create-tasks').click(function() {
    $(this).attr('disabled', true);
    getContacts();
  });
});
