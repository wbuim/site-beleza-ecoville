const { DataTypes } = require('sequelize');
const db = require('../db');
const MenuSite = db.define('MenuSite', {
    nome: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT },
    preco: { type: DataTypes.DECIMAL(10, 2) },
    tempo: { type: DataTypes.STRING },
    categoria: { type: DataTypes.STRING }
});
module.exports = MenuSite;