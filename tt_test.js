const m = require('./routes/translate');
m.translateTexts(["Bo'lim", "Manzil", "Rasmlar"], 'ru')
  .then(o => console.log(JSON.stringify(o)))
  .catch(e => console.log('ERR', e.message));
