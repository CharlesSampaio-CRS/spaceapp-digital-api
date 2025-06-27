import { getConfig } from '../config/performance.js';

const config = getConfig();

export class PaginationHelper {
  constructor(page = config.PAGINATION.DEFAULT_PAGE, limit = config.PAGINATION.DEFAULT_LIMIT) {
    this.page = Math.max(1, parseInt(page) || config.PAGINATION.DEFAULT_PAGE);
    this.limit = Math.min(
      config.PAGINATION.MAX_LIMIT, 
      Math.max(1, parseInt(limit) || config.PAGINATION.DEFAULT_LIMIT)
    );
    this.skip = (this.page - 1) * this.limit;
  }

  getMongoOptions() {
    return {
      skip: this.skip,
      limit: this.limit
    };
  }

  getResponse(totalCount) {
    const totalPages = Math.ceil(totalCount / this.limit);
    const hasNextPage = this.page < totalPages;
    const hasPrevPage = this.page > 1;

    return {
      pagination: {
        page: this.page,
        limit: this.limit,
        totalCount,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? this.page + 1 : null,
        prevPage: hasPrevPage ? this.page - 1 : null
      }
    };
  }
}

// Função para aplicar paginação em consultas MongoDB
export const applyPagination = (query, page, limit) => {
  const pagination = new PaginationHelper(page, limit);
  
  return {
    query: query.skip(pagination.skip).limit(pagination.limit),
    pagination
  };
};

// Função para paginação com cursor (mais eficiente para grandes datasets)
export const cursorPagination = (query, cursor, limit = config.PAGINATION.DEFAULT_LIMIT) => {
  const paginationLimit = Math.min(config.PAGINATION.MAX_LIMIT, Math.max(1, parseInt(limit) || config.PAGINATION.DEFAULT_LIMIT));
  
  let paginatedQuery = query.limit(paginationLimit + 1); // +1 para verificar se há mais páginas
  
  if (cursor) {
    // Assumindo que o cursor é baseado em _id ou outro campo único
    paginatedQuery = paginatedQuery.find({ _id: { $gt: cursor } });
  }
  
  return {
    query: paginatedQuery,
    limit: paginationLimit
  };
};

// Função para processar resultado com cursor
export const processCursorResult = (results, limit) => {
  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? results[limit - 1]._id : null;
  
  return {
    data: items,
    pagination: {
      hasMore,
      nextCursor,
      count: items.length
    }
  };
};

// Função para paginação otimizada com projeção
export const optimizedPagination = async (collection, filter = {}, projection = {}, page, limit) => {
  const pagination = new PaginationHelper(page, limit);
  
  // Executar consultas em paralelo
  const [data, totalCount] = await Promise.all([
    collection
      .find(filter, { projection })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray(),
    collection.countDocuments(filter)
  ]);
  
  return {
    data,
    ...pagination.getResponse(totalCount)
  };
};

// Função para paginação com ordenação otimizada
export const sortedPagination = (collection, filter = {}, sort = {}, page, limit) => {
  const pagination = new PaginationHelper(page, limit);
  
  return collection
    .find(filter)
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit)
    .toArray();
};

// Middleware para extrair parâmetros de paginação
export const paginationMiddleware = () => {
  return (request, reply, done) => {
    const page = parseInt(request.query.page) || config.PAGINATION.DEFAULT_PAGE;
    const limit = parseInt(request.query.limit) || config.PAGINATION.DEFAULT_LIMIT;
    
    // Validar parâmetros
    if (page < 1) {
      return done(new Error('Página deve ser maior que 0'));
    }
    
    if (limit < 1 || limit > config.PAGINATION.MAX_LIMIT) {
      return done(new Error(`Limite deve estar entre 1 e ${config.PAGINATION.MAX_LIMIT}`));
    }
    
    request.pagination = new PaginationHelper(page, limit);
    done();
  };
};

// Função para criar links de paginação
export const createPaginationLinks = (baseUrl, pagination, query = {}) => {
  const { page, totalPages, hasNextPage, hasPrevPage } = pagination;
  
  const links = {
    self: `${baseUrl}?${new URLSearchParams({ ...query, page })}`,
    first: `${baseUrl}?${new URLSearchParams({ ...query, page: 1 })}`,
    last: `${baseUrl}?${new URLSearchParams({ ...query, page: totalPages })}`
  };
  
  if (hasPrevPage) {
    links.prev = `${baseUrl}?${new URLSearchParams({ ...query, page: page - 1 })}`;
  }
  
  if (hasNextPage) {
    links.next = `${baseUrl}?${new URLSearchParams({ ...query, page: page + 1 })}`;
  }
  
  return links;
};

// Função para resposta padronizada com paginação
export const paginatedResponse = (data, pagination, baseUrl, query = {}) => {
  return {
    success: true,
    data,
    pagination: {
      ...pagination,
      links: createPaginationLinks(baseUrl, pagination, query)
    }
  };
}; 